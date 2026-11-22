// GBN AI: what each tier is called and the emails sent after a purchase.
// Used by netlify/functions/gbn-stripe-webhook.js.
//
// The download links and upgrade links are NOT in this file (the repo is
// public). They come from the Netlify env var GBN_DELIVERY, JSON like:
//   {
//     "tiers": {
//       "researcher": { "url": "https://drive.google.com/drive/folders/..." },
//       "social":     { "url": "..." },
//       "editor":     { "url": "..." },
//       "outreach":   { "url": "..." },
//       "full":       { "url": "..." }
//     },
//     "upgrades": { "researcher": "https://buy.stripe.com/...", "social": "...", "editor": "...", "outreach": "..." }
//   }
// A tier with no url still gets a "files coming within 24 hours" email, and
// Nathan's sale ping says the files are missing.

const SITE = 'https://vocreativeco.com';
const MAILING_ADDRESS = '2929 Hannah Blvd, East Lansing, MI';
const DISCORD = 'https://discord.gg/jSfpvGcPmA';

const TIERS = {
  researcher: { name: 'Viral Video Researcher', price: 57 },
  social: { name: 'Social Manager + Content Coach', price: 77 },
  editor: { name: 'AI Video Editor (all styles)', price: 87 },
  outreach: { name: 'AI Outreach System', price: 87 },
  full: { name: 'GBN AI: the full Claude team', price: 247 },
};

// Stripe payment link id -> tier (ids are not secret: the buy URL can't be
// rebuilt from them). Created by scripts/gbn-stripe-setup.js. Checkout
// sessions also carry the link's metadata (tier, gbn_key); this is the backup.
const PAYMENT_LINKS = {
  plink_1UefhmQQ9MdDPoinb9FIOetQ: { tier: 'researcher' },
  plink_1UefhnQQ9MdDPoinKetasuEG: { tier: 'social' },
  plink_1UefhnQQ9MdDPoinAdcHFaZ3: { tier: 'editor' },
  plink_1UefhoQQ9MdDPoinf01eMzg6: { tier: 'outreach' },
  plink_1UefhpQQ9MdDPoinep9npaT2: { tier: 'full' },
  plink_1UefhpQQ9MdDPoinhL14DKf2: { tier: 'full', upgradeFrom: 'researcher' },
  plink_1UefhqQQ9MdDPoinHngdas0A: { tier: 'full', upgradeFrom: 'social' },
  plink_1UefhqQQ9MdDPoinkoXrCzO2: { tier: 'full', upgradeFrom: 'editor' },
  plink_1UefhrQQ9MdDPoinGoS1EFTE: { tier: 'full', upgradeFrom: 'outreach' },
};

// Which GBN tier a Stripe checkout session bought, or null if it isn't GBN AI.
function tierOf(session) {
  const meta = session.metadata || {};
  const link = PAYMENT_LINKS[session.payment_link];
  if (link) return { tier: link.tier, upgradeFrom: link.upgradeFrom || meta.upgrade_from || '' };
  if (meta.gbn_key && TIERS[meta.tier]) return { tier: meta.tier, upgradeFrom: meta.upgrade_from || '' };
  return null;
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
    return { tiers: d.tiers || {}, upgrades: d.upgrades || {} };
  } catch (e) {
    return { tiers: {}, upgrades: {} };
  }
}

function button(href, label, bg = '#0a0a0a') {
  return `<a href="${esc(href)}" style="display:inline-block;padding:15px 22px;background:${bg};border-radius:10px;font:700 16px/1 ${FONT};color:#ffffff;text-decoration:none">${label}</a>`;
}

// Email to the buyer. Returns { subject, html, text }.
function buyerEmail({ tier, name, delivery }) {
  const t = TIERS[tier];
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const hey = first ? `Hey ${first},` : 'Hey,';
  const files = (delivery.tiers[tier] || {}).url || '';
  const upgrade = tier !== 'full' ? delivery.upgrades[tier] || '' : '';
  const upgradePrice = 247 - t.price;
  const subject = files ? `Your ${t.name} files` : `Thanks for getting ${t.name}`;

  const filesBlock = files
    ? `<p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:#1a1a1a">Everything is in this folder: the Claude skill files and the setup guide. Start with the setup guide.</p>
    ${button(files, 'Open your files &rarr;')}
    <p style="margin:10px 0 0;font:14px/1.5 ${FONT};color:#6b6b6b">Save this email. The folder gets updated when I improve the system.</p>`
    : `<p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:#1a1a1a">I&rsquo;m putting your files together by hand right now. You&rsquo;ll get them at this email within 24 hours.</p>`;

  const upgradeBlock = upgrade
    ? `<tr><td style="padding:28px 0 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e6e6;border-radius:14px;background:#fafafa"><tr><td style="padding:20px">
      <h2 style="margin:0 0 8px;font:800 20px/1.2 ${FONT};color:#0a0a0a">Want the whole team later?</h2>
      <p style="margin:0 0 14px;font:15px/1.55 ${FONT};color:#3a3a3a">You already paid $${t.price}, so the full GBN AI team is $${upgradePrice} for you instead of $247.</p>
      ${button(upgrade, `Upgrade for $${upgradePrice} &rarr;`, '#E8352B')}
    </td></tr></table>
  </td></tr>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
  <tr><td>
    <p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:#1a1a1a">${esc(hey)}</p>
    <h1 style="margin:0 0 14px;font:800 28px/1.15 ${FONT};letter-spacing:-.02em;color:#0a0a0a">Thanks for getting ${esc(t.name)}.</h1>
    ${filesBlock}
  </td></tr>
  <tr><td style="padding:28px 0 0">
    <h2 style="margin:0 0 8px;font:800 20px/1.2 ${FONT};color:#0a0a0a">Stuck on a step?</h2>
    <p style="margin:0 0 14px;font:16px/1.6 ${FONT};color:#1a1a1a">Ask me in #ask-nathan on my Discord, or just reply to this email.</p>
    ${button(DISCORD, 'Join the Discord &rarr;', '#5865F2')}
  </td></tr>
  ${upgradeBlock}
  <tr><td style="padding:24px 0 0"><p style="margin:0;font:16px/1.6 ${FONT};color:#1a1a1a">Nathan</p></td></tr>
  <tr><td style="padding:36px 0 0;border-bottom:1px solid #eeeeee"></td></tr>
  <tr><td style="padding:16px 0 0;font:12px/1.6 ${FONT};color:#8a8a8a">You&rsquo;re getting this because you bought ${esc(t.name)} at <a href="${SITE}/ai/" style="color:#8a8a8a">vocreativeco.com/ai</a>. Your receipt comes separately from Stripe.<br>Vo Creative Co. &middot; ${esc(MAILING_ADDRESS)}</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    hey,
    '',
    `Thanks for getting ${t.name}.`,
    files
      ? `Everything is in this folder: the Claude skill files and the setup guide. Start with the setup guide.\n${files}\nSave this email. The folder gets updated when I improve the system.`
      : "I'm putting your files together by hand right now. You'll get them at this email within 24 hours.",
    '',
    'Stuck on a step? Ask me in #ask-nathan on my Discord, or just reply to this email.',
    DISCORD,
    ...(upgrade ? ['', `Want the whole team later? You already paid $${t.price}, so the full GBN AI team is $${upgradePrice} for you instead of $247:`, upgrade] : []),
    '',
    'Nathan',
    '',
    '--',
    `You're getting this because you bought ${t.name} at ${SITE}/ai/. Your receipt comes separately from Stripe.`,
    `Vo Creative Co. · ${MAILING_ADDRESS}`,
  ].join('\n');

  return { subject, html, text };
}

// Short ping to Nathan about the sale.
function saleEmail({ tier, upgradeFrom, email, name, amount, source, sessionId, hasFiles }) {
  const t = TIERS[tier];
  const what = upgradeFrom ? `${t.name} (upgrade from ${TIERS[upgradeFrom] ? TIERS[upgradeFrom].name : upgradeFrom})` : t.name;
  const subject = `${hasFiles ? '' : '[Send files] '}New sale: ${what}, $${amount}`;
  const lines = [
    `<b>${esc(what)}</b> for <b>$${esc(amount)}</b>`,
    `Buyer: ${esc(name || '(no name)')} &lt;${esc(email)}&gt;`,
    source ? `Came from: ${esc(source)}` : '',
    hasFiles ? 'Their files email went out automatically.' : '<b>No files are set up for this tier yet, so they were told to expect them within 24 hours. Send them by hand.</b>',
    `Stripe: <a href="https://dashboard.stripe.com/checkout/sessions/${esc(sessionId)}">open the payment</a>`,
  ].filter(Boolean);
  const html = `<div style="font:15px/1.6 ${FONT};color:#111">${lines.map((l) => `<p style="margin:0 0 8px">${l}</p>`).join('')}</div>`;
  return { subject, html };
}

module.exports = { TIERS, PAYMENT_LINKS, tierOf, readDelivery, buyerEmail, saleEmail };
