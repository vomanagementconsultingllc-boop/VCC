#!/usr/bin/env node
// One-time setup of the GBN AI offer in Stripe: products, prices and payment
// links. Safe to re-run: everything is found by metadata (gbn_key) first, and
// creates use idempotency keys.
//
//   node scripts/gbn-stripe-setup.js            create/find everything, print the ids
//   node scripts/gbn-stripe-setup.js activate   switch every GBN payment link on
//   node scripts/gbn-stripe-setup.js deactivate switch every GBN payment link off
//
// In Claude cloud sessions the proxy fills in the Stripe key:
//   STRIPE_KEY=proxy-injected NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/gbn-stripe-setup.js
//
// Upgrade links are printed but kept out of this public repo on purpose: they
// only go to buyers (Netlify env GBN_DELIVERY).

const KEY = process.env.STRIPE_KEY || 'proxy-injected';
const SITE = 'https://vocreativeco.com';

const TIERS = [
  { key: 'researcher', name: 'Viral Video Researcher', price: 5700,
    description: 'A Claude research agent that finds short-form videos blowing up in your niche, breaks down why they worked, and turns them into ready-to-film ideas with hooks.' },
  { key: 'social', name: 'Social Manager + Content Coach', price: 7700,
    description: 'Two Claude agents: a social media manager that plans and briefs every post, and a content coach that checks how every video did and tells you what to fix.' },
  { key: 'editor', name: 'AI Video Editor (all styles)', price: 8700,
    description: 'Claude video editors for every style: quick cut, full edit, dead-space cut, green screen and news. It storyboards first, then hands you a finished vertical video.' },
  { key: 'outreach', name: 'AI Outreach System', price: 8700,
    description: 'A Claude outreach system that builds your lead list, scores every lead, writes personal first messages in your voice and tracks each follow-up in one sheet.' },
  { key: 'full', name: 'GBN AI: the full Claude team', price: 24700,
    description: 'Every system: the research agent, social manager, content coach, every video editor and the outreach system. The Claude team Nathan runs his content and sales with.' },
];
// Upgrade to the full team for $247 minus what they already paid.
const UPGRADES = [
  { from: 'researcher', price: 19000 },
  { from: 'social', price: 17000 },
  { from: 'editor', price: 16000 },
  { from: 'outreach', price: 16000 },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function form(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === 'object') form(v, key, out);
    else if (v !== undefined) out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join('&');
}
async function stripe(method, p, body, idem) {
  for (let attempt = 1; ; attempt += 1) {
    const headers = { Authorization: `Bearer ${KEY}` };
    if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idem) headers['Idempotency-Key'] = idem;
    const res = await fetch('https://api.stripe.com/v1' + p, { method, headers, body: body ? form(body) : undefined });
    const data = await res.json();
    if (res.ok) return data;
    if (res.status === 429 && attempt < 4) { await wait(1500); continue; }
    throw new Error(`Stripe ${method} ${p} -> ${res.status} ${JSON.stringify(data.error || data).slice(0, 400)}`);
  }
}
async function listAll(p) {
  const out = []; let after;
  for (;;) {
    const page = await stripe('GET', `${p}${p.includes('?') ? '&' : '?'}limit=100${after ? `&starting_after=${after}` : ''}`);
    out.push(...page.data);
    if (!page.has_more) return out;
    after = page.data[page.data.length - 1].id;
  }
}

async function setup() {
  const products = (await listAll('/products?active=true')).filter((p) => p.metadata && p.metadata.gbn_key);
  const prices = (await listAll('/prices?active=true')).filter((p) => p.metadata && p.metadata.gbn_key);
  const links = (await listAll('/payment_links')).filter((l) => l.metadata && l.metadata.gbn_key);
  const out = { products: {}, links: {}, upgrades: {} };

  const findOrCreateProduct = async (t) => {
    const found = products.find((p) => p.metadata.gbn_key === t.key);
    if (found) return found;
    return stripe('POST', '/products', {
      name: t.name, description: t.description, type: 'service',
      metadata: { gbn_key: t.key, brand: 'GBN AI', created_by: 'vocreativeco.com' },
    }, `gbn-product-${t.key}`);
  };
  const findOrCreatePrice = async (product, key, amount, nickname) => {
    const found = prices.find((p) => p.metadata.gbn_key === key && p.unit_amount === amount);
    if (found) return found;
    return stripe('POST', '/prices', {
      product: product.id, currency: 'usd', unit_amount: amount, nickname,
      metadata: { gbn_key: key },
    }, `gbn-price-${key}-${amount}`);
  };
  const findOrCreateLink = async (price, key, tier, extra = {}) => {
    const found = links.find((l) => l.metadata.gbn_key === key);
    if (found) return found;
    return stripe('POST', '/payment_links', {
      line_items: { 0: { price: price.id, quantity: 1 } },
      after_completion: { type: 'redirect', redirect: { url: `${SITE}/ai/thanks/?t=${tier}&session_id={CHECKOUT_SESSION_ID}` } },
      customer_creation: 'always',
      allow_promotion_codes: 'true',
      custom_text: { submit: { message: 'Your files are emailed to you right after you pay.' } },
      metadata: { gbn_key: key, tier, ...extra },
      payment_intent_data: { metadata: { gbn_key: key, tier } },
    }, `gbn-link-${key}`);
  };

  const byKey = {};
  for (const t of TIERS) {
    const product = await findOrCreateProduct(t);
    const price = await findOrCreatePrice(product, t.key, t.price, `${t.name} ($${t.price / 100})`);
    const link = await findOrCreateLink(price, t.key, t.key);
    byKey[t.key] = { product, price };
    out.products[t.key] = { product: product.id, price: price.id, amount: t.price / 100 };
    out.links[t.key] = { id: link.id, url: link.url, active: link.active };
  }
  for (const u of UPGRADES) {
    const key = `upgrade-${u.from}`;
    const price = await findOrCreatePrice(byKey.full.product, `upgrade-${u.price}`, u.price, `Upgrade to the full team ($${u.price / 100})`);
    const link = await findOrCreateLink(price, key, 'full', { upgrade_from: u.from });
    out.upgrades[u.from] = { id: link.id, url: link.url, active: link.active, amount: u.price / 100 };
  }
  console.log(JSON.stringify(out, null, 2));
}

async function setActive(active) {
  const links = (await listAll('/payment_links')).filter((l) => l.metadata && l.metadata.gbn_key);
  for (const l of links) {
    if (l.active === active) continue;
    await stripe('POST', `/payment_links/${l.id}`, { active: String(active) });
    console.log(`${active ? 'on ' : 'off'} ${l.metadata.gbn_key} ${l.url}`);
  }
  console.log(`${links.length} GBN links are now ${active ? 'on' : 'off'}.`);
}

(async () => {
  const cmd = process.argv[2];
  if (!cmd) return setup();
  if (cmd === 'activate') return setActive(true);
  if (cmd === 'deactivate') return setActive(false);
  console.error('usage: (no args) | activate | deactivate');
  process.exit(2);
})().catch((e) => { console.error(e.message); process.exit(1); });
