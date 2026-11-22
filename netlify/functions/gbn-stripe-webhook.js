// Stripe webhook for GBN AI sales: https://vocreativeco.com/.netlify/functions/gbn-stripe-webhook
// Listens for checkout.session.completed (and async_payment_succeeded). For a
// paid GBN AI checkout (one of the GBN payment links) it:
//   1. emails the buyer their files (netlify/lib/gbn-delivery.js),
//   2. pings Nathan about the sale,
//   3. saves the buyer as a Resend contact with gbn_purchases.
// Every other Stripe checkout on the account (other businesses) is ignored.
//
// Netlify env: STRIPE_WEBHOOK_SECRET (the endpoint's signing secret),
// GBN_DELIVERY (download + upgrade links, see netlify/lib/gbn-delivery.js),
// RESEND_API_KEY. Emails use idempotency keys, so Stripe retries never send twice.

const crypto = require('crypto');
const { tierOf, readDelivery, buyerEmail, saleEmail } = require('../lib/gbn-delivery.js');

const RESEND_API = process.env.RESEND_API_BASE || 'https://api.resend.com';
const FROM = process.env.RESEND_FROM || 'Nathan Vo <nathan@vocreativeco.com>';
const REPLY_TO = process.env.RESEND_REPLY_TO || 'nathan@vocreativeco.com';
const NOTIFY = process.env.GBN_NOTIFY_EMAIL || 'nathan@vocreativeco.com';
const TOLERANCE_SECONDS = 300;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Stripe-Signature: t=<unix>,v1=<hex hmac of "t.body">[,v1=...]
function verify(rawBody, header, secret, now = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return false;
  const parts = {};
  header.split(',').forEach((kv) => {
    const i = kv.indexOf('=');
    if (i < 0) return;
    const k = kv.slice(0, i).trim();
    (parts[k] = parts[k] || []).push(kv.slice(i + 1).trim());
  });
  const t = Number((parts.t || [])[0]);
  if (!t || Math.abs(now - t) > TOLERANCE_SECONDS) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  return (parts.v1 || []).some((sig) => {
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'));
  });
}

async function resend(method, path, body, idempotencyKey) {
  const headers = { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(RESEND_API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    if (res.ok) return text ? JSON.parse(text) : {};
    if (res.status === 429 && attempt < 3) { await wait(1000); continue; }
    const err = new Error(`Resend ${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
}

async function saveBuyer(email, name, tier) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  let had = '';
  try {
    const c = await resend('GET', `/contacts/${encodeURIComponent(email)}`);
    had = (c.properties && (c.properties.gbn_purchases && (c.properties.gbn_purchases.value ?? c.properties.gbn_purchases))) || '';
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  const list = Array.from(new Set(String(had || '').split(',').map((s) => s.trim()).filter(Boolean).concat(tier)));
  const fields = { properties: { gbn_purchases: list.join(',') } };
  if (first) fields.first_name = first;
  try {
    await resend('POST', '/contacts', { email, unsubscribed: false, ...fields });
  } catch (err) {
    if (err.status !== 409 && err.status !== 422) throw err;
    await resend('PATCH', `/contacts/${encodeURIComponent(email)}`, fields);
  }
  return list.join(',');
}

async function handleSession(s) {
  const which = tierOf(s);
  if (!which) return 'not a GBN AI checkout; ignored';
  const { tier, upgradeFrom } = which;
  if (s.payment_status !== 'paid') return `GBN checkout ${s.id} not paid yet (${s.payment_status}); waiting`;
  const email = (s.customer_details && s.customer_details.email) || s.customer_email;
  if (!email) return `GBN checkout ${s.id} has no email`;
  const name = (s.customer_details && s.customer_details.name) || '';
  const delivery = readDelivery(process.env.GBN_DELIVERY);
  const hasFiles = Boolean((delivery.tiers[tier] || {}).url);
  const done = [];

  const msg = buyerEmail({ tier, name, delivery });
  const sent = await resend('POST', '/emails', {
    from: FROM, to: [email], reply_to: REPLY_TO,
    subject: msg.subject, html: msg.html, text: msg.text,
    tags: [{ name: 'gbn', value: tier }],
  }, `gbn-buyer-${s.id}`);
  done.push(`buyer email ${sent.id}${hasFiles ? '' : ' (no files yet)'}`);

  try {
    const ping = saleEmail({
      tier, upgradeFrom, email, name,
      amount: ((s.amount_total || 0) / 100).toFixed(2).replace(/\.00$/, ''),
      source: s.client_reference_id || '', sessionId: s.id, hasFiles,
    });
    await resend('POST', '/emails', { from: FROM, to: [NOTIFY], subject: ping.subject, html: ping.html }, `gbn-sale-${s.id}`);
    done.push('Nathan pinged');
  } catch (err) {
    done.push(`ping failed: ${err.message}`);
  }

  try {
    done.push(`contact gbn_purchases=${await saveBuyer(email, name, tier)}`);
  } catch (err) {
    done.push(`contact not saved: ${err.message}`);
  }
  return `GBN sale ${tier} ${s.id}: ${done.join('; ')}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!verify(raw, sig, process.env.STRIPE_WEBHOOK_SECRET)) {
    console.error('Bad or missing Stripe signature');
    return { statusCode: 400, body: 'bad signature' };
  }
  let evt;
  try { evt = JSON.parse(raw); } catch (e) { return { statusCode: 400, body: 'bad json' }; }

  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(evt.type)) {
    return { statusCode: 200, body: `ignored ${evt.type}` };
  }
  try {
    const result = await handleSession(evt.data.object);
    console.log(result);
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    // 500 makes Stripe retry later; the idempotency keys stop double emails.
    console.error(`GBN webhook failed: ${err.message}`);
    return { statusCode: 500, body: 'retry' };
  }
};

exports._test = { verify, handleSession };
