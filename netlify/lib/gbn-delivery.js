// GBN AI: what each system is called and the emails sent after a purchase.
// Used by netlify/functions/gbn-stripe-webhook.js.
//
// A purchase is one of the carts from scripts/gbn-stripe-setup.js: the AI
// Video Editor alone, the editor plus add-ons, or GBN AI (everything).
//
// The download links are NOT in this file (the repo is public). They come from
// the Netlify env var GBN_DELIVERY, JSON like:
//   {
//     "tiers": {
//       "editor":     { "url": "https://drive.google.com/drive/folders/..." },
//       "researcher": { "url": "..." },
//       "social":     { "url": "..." },
//       "outreach":   { "url": "..." },
//       "full":       { "url": "<folder with all 4>", "bonus": "<the bonus video>" }
//     }
//   }
// A system with no url still gets a "coming within 24 hours" line, and
// Nathan's sale ping says which files to send by hand.

const SITE = 'https://vocreativeco.com';
const MAILING_ADDRESS = '2929 Hannah Blvd, East Lansing, MI';
const DISCORD = 'https://discord.gg/jSfpvGcPmA';

const TIERS = {
  editor: { name: 'AI Video Editor', price: 97 },
  researcher: { name: 'Viral Video Researcher', price: 37 },
  social: { name: 'Social Media Manager', price: 37 },
  outreach: { name: 'AI Outreach System', price: 69 },
  full: { name: 'GBN AI: the full Claude team', price: 179 },
};

// Stripe payment link id -> what it sells (ids are not secret: the buy URL
// can't be rebuilt from them). Checkout sessions also carry the link's
// metadata (tiers); this map is the backup.
const PAYMENT_LINKS = {
  plink_1UekwgQQ9MdDPoinJuQsd7yl: ['editor'],
  plink_1UekwgQQ9MdDPoinO6xXnBPF: ['editor', 'researcher'],
  plink_1UekwhQQ9MdDPoinmnqzJobJ: ['editor', 'social'],
  plink_1UekwhQQ9MdDPoingKXDiCaA: ['editor', 'outreach'],
  plink_1UekwiQQ9MdDPoin2UHnIPqq: ['editor', 'researcher', 'social'],
  plink_1UekwjQQ9MdDPoinwPmz34xE: ['full'],
};

// Which GBN systems a Stripe checkout session bought, or null if it isn't GBN AI.
function tiersOf(session) {
  const fromLink = PAYMENT_LINKS[session.payment_link];
  if (fromLink) return fromLink.slice();
  const meta = session.metadata || {};
  if (!meta.gbn_key || !meta.tiers) return null;
  const list = String(meta.tiers).split(',').map((s) => s.trim()).filter((k) => TIERS[k]);
  return list.length ? list : null;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function readDelivery(raw) {
  try {
    const d = JSON.parse(raw || '{}');
    return { tiers: d.tiers || {} };
  } catch (e) {
    return { tiers: {} };
  }
}

function button(href, label, bg = '#0a0a0a') {
  return `<a href="${esc(href)}" style="display:inline-block;padding:14px 20px;background:${bg};border-radius:10px;font:700 15px/1 ${FONT};color:#ffffff;text-decoration:none">${label}</a>`;
}

// One row per thing they get: { name, url, kind } (kind: 'files' or 'video').
function itemsFor(tiers, delivery) {
  const items = [];
  tiers.forEach((k) => {
    const d = delivery.tiers[k] || {};
    items.push({ name: TIERS[k].name, url: d.url || '', kind: 'files' });
    if (k === 'full') items.push({ name: 'Bonus: how I use it to make content that goes viral', url: d.bonus || '', kind: 'video' });
  });
  return items;
}

const productName = (tiers) => (tiers.length === 1 ? TIERS[tiers[0]].name : tiers.map((k) => TIERS[k].name).join(' + '));

// Email to the buyer. Returns { subject, html, text, missing }.
function buyerEmail({ tiers, name, delivery }) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const hey = first ? `Hey ${first},` : 'Hey,';
  const items = itemsFor(tiers, delivery);
  const missing = items.filter((i) => !i.url).map((i) => i.name);
  const what = productName(tiers);
  const subject = missing.length === items.length ? `Thanks for getting ${what}` : `Your ${tiers[0] === 'full' ? 'GBN AI' : what} files`;

  const rows = items.map((i) => {
    const action = i.url
      ? button(i.url, i.kind === 'video' ? 'Watch the video &rarr;' : 'Open your files &rarr;')
      : `<p style="margin:0;font:15px/1.5 ${FONT};color:#3a3a3a">I&rsquo;m putting this together by hand. You&rsquo;ll get it at this email within 24 hours.</p>`;
    return `<tr><td style="padding:12px 0 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e6e6;border-radius:14px;background:#fafafa"><tr><td style="padding:18px 20px">
      <h2 style="margin:0 0 12px;font:800 19px/1.25 ${FONT};color:#0a0a0a">${esc(i.name)}</h2>
      ${action}
    </td></tr></table>
  </td></tr>`;
  }).join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
  <tr><td>
    <p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:#1a1a1a">${esc(hey)}</p>
    <h1 style="margin:0 0 12px;font:800 28px/1.15 ${FONT};letter-spacing:-.02em;color:#0a0a0a">Thanks for getting ${esc(tiers[0] === 'full' ? 'GBN AI' : what)}.</h1>
    <p style="margin:0 0 4px;font:16px/1.6 ${FONT};color:#1a1a1a">Each folder has the Claude skill files and a setup guide. Start with the setup guide. Save this email: the folders get updated when I improve the systems.</p>
  </td></tr>
  ${rows}
  <tr><td style="padding:28px 0 0">
    <h2 style="margin:0 0 8px;font:800 20px/1.2 ${FONT};color:#0a0a0a">Stuck on a step?</h2>
    <p style="margin:0 0 14px;font:16px/1.6 ${FONT};color:#1a1a1a">Ask me in #ask-nathan on my Discord, or just reply to this email.</p>
    ${button(DISCORD, 'Join the Discord &rarr;', '#5865F2')}
  </td></tr>
  <tr><td style="padding:24px 0 0"><p style="margin:0;font:16px/1.6 ${FONT};color:#1a1a1a">Nathan</p></td></tr>
  <tr><td style="padding:36px 0 0;border-bottom:1px solid #eeeeee"></td></tr>
  <tr><td style="padding:16px 0 0;font:12px/1.6 ${FONT};color:#8a8a8a">You&rsquo;re getting this because you bought ${esc(what)} at <a href="${SITE}/ai/" style="color:#8a8a8a">vocreativeco.com/ai</a>. Your receipt comes separately from Stripe.<br>Vo Creative Co. &middot; ${esc(MAILING_ADDRESS)}</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    hey,
    '',
    `Thanks for getting ${tiers[0] === 'full' ? 'GBN AI' : what}.`,
    'Each folder has the Claude skill files and a setup guide. Start with the setup guide. Save this email: the folders get updated when I improve the systems.',
    '',
    ...items.flatMap((i) => [i.name.toUpperCase(), i.url || "I'm putting this together by hand. You'll get it at this email within 24 hours.", '']),
    'Stuck on a step? Ask me in #ask-nathan on my Discord, or just reply to this email.',
    DISCORD,
    '',
    'Nathan',
    '',
    '--',
    `You're getting this because you bought ${what} at ${SITE}/ai/. Your receipt comes separately from Stripe.`,
    `Vo Creative Co. · ${MAILING_ADDRESS}`,
  ].join('\n');

  return { subject, html, text, missing };
}

// Short ping to Nathan about the sale.
function saleEmail({ tiers, email, name, amount, source, sessionId, missing }) {
  const what = productName(tiers);
  const subject = `${missing.length ? '[Send files] ' : ''}New sale: ${what}, $${amount}`;
  const lines = [
    `<b>${esc(what)}</b> for <b>$${esc(amount)}</b>`,
    `Buyer: ${esc(name || '(no name)')} &lt;${esc(email)}&gt;`,
    source ? `Came from: ${esc(source)}` : '',
    missing.length
      ? `<b>Not set up yet, so they were told to expect it within 24 hours. Send by hand:</b> ${missing.map(esc).join(', ')}`
      : 'Their files email went out automatically.',
    `Stripe: <a href="https://dashboard.stripe.com/checkout/sessions/${esc(sessionId)}">open the payment</a>`,
  ].filter(Boolean);
  const html = `<div style="font:15px/1.6 ${FONT};color:#111">${lines.map((l) => `<p style="margin:0 0 8px">${l}</p>`).join('')}</div>`;
  return { subject, html };
}

module.exports = { TIERS, PAYMENT_LINKS, tiersOf, readDelivery, buyerEmail, saleEmail };
