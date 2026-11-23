#!/usr/bin/env node
// GBN AI offer in Stripe: products, prices and payment links. Safe to re-run:
// everything is found by metadata first, and creates use idempotency keys.
//
// The offer (Nathan, Nov 23, 2026):
//   - The landing page sells one thing: the AI Video Editor, $97.
//   - The checkout step (/ai/checkout/) offers the other 3 as add-ons. Their
//     regular price is $197 each. For the first hour after someone opens
//     checkout they're $37 / $37 / $69; after that hour they're $197.
//   - Adding any of them offers GBN AI (all 4 + bonus video + private Discord)
//     for $179. A cart at or over $179 is always pointed to GBN AI first.
//   - GBN AI goes to $997 on Dec 31 (the checkout page counts down to it).
// So there is one payment link per cart the checkout page can send people to.
// A cart item "researcher@197" means the add-on at its regular price.
//
//   node scripts/gbn-stripe-setup.js            create/find everything, retire old links and prices, print ids
//   node scripts/gbn-stripe-setup.js activate   switch the current links on
//   node scripts/gbn-stripe-setup.js deactivate switch the current links off
//   node scripts/gbn-stripe-setup.js savings    print the checkout text for each cart
//
// In Claude cloud sessions the proxy fills in the Stripe key:
//   STRIPE_KEY=proxy-injected NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/gbn-stripe-setup.js

const KEY = process.env.STRIPE_KEY || 'proxy-injected';
const SITE = 'https://vocreativeco.com';

const TIERS = {
  editor: { name: 'AI Video Editor', price: 9700,
    description: 'Claude video editors for every style: quick cut, full edit, dead-space cut, green screen and news. It storyboards first, then hands you a finished vertical video.' },
  researcher: { name: 'Viral Video Researcher', price: 3700, regular: 19700,
    description: 'A Claude research agent that finds short-form videos blowing up in your niche, breaks down why they worked, and turns them into ready-to-film ideas with hooks.' },
  social: { name: 'Social Media Manager', price: 3700, regular: 19700,
    description: 'A Claude social media manager that briefs every post and keeps your calendar, with a content coach that checks how every video did and tells you what to fix.' },
  outreach: { name: 'AI Outreach System', price: 6900, regular: 19700,
    description: 'A Claude outreach system that builds your lead list, scores every lead, writes personal first messages in your voice and tracks each follow-up in one sheet.' },
  full: { name: 'GBN AI: the full Claude team', price: 17900,
    description: 'All 4 systems: the AI Video Editor, Viral Video Researcher, Social Media Manager and AI Outreach System. Plus a bonus video on making content that goes viral, and the private GBN AI Discord.' },
};

// The carts /ai/checkout/ can send people to. Keys are the link's gbn_key.
const CARTS = [
  // 1-hour prices
  ['editor'],
  ['editor', 'researcher'],
  ['editor', 'social'],
  ['editor', 'outreach'],
  ['editor', 'researcher', 'social'],
  ['full'],
  // after the hour: add-ons at $197
  ['editor', 'researcher@197'],
  ['editor', 'social@197'],
  ['editor', 'outreach@197'],
  ['editor', 'researcher@197', 'social@197'],
  ['editor', 'researcher@197', 'outreach@197'],
  ['editor', 'social@197', 'outreach@197'],
  ['editor', 'researcher@197', 'social@197', 'outreach@197'],
];
const base = (item) => item.split('@')[0];
const itemPrice = (item) => (item.endsWith('@197') ? TIERS[base(item)].regular : TIERS[item].price);
const cartKey = (cart) => cart.join('+');
const cartTotal = (cart) => cart.reduce((n, k) => n + itemPrice(k), 0);

// What you'd pay instead in the first 30 days (Nathan's numbers, Nov 23, 2026):
// a quality editor charges $50 a video ($1,500 for 30 daily videos), and a
// social media manager costs $2,000. Same numbers as the chart on
// /ai/checkout/. Shown at checkout above the Pay button.
const EDITOR_PER_VIDEO = 50;
const DAYS = 30;
const SMM_30_DAYS = 2000;
const money = (n) => `$${n.toLocaleString('en-US')}`;

// Savings = what they'd pay instead, minus what they pay us.
function savingsText(cart) {
  const editor = EDITOR_PER_VIDEO * DAYS;
  const total = cartTotal(cart) / 100;
  const hasSmm = cart[0] === 'full' || cart.map(base).includes('social');
  const instead = hasSmm
    ? `A quality editor charges ${money(EDITOR_PER_VIDEO)} a video (${money(editor)} to post every day for ${DAYS} days), and a social media manager costs ${money(SMM_30_DAYS)}. That's ${money(editor + SMM_30_DAYS)}.`
    : `A quality editor charges ${money(EDITOR_PER_VIDEO)} a video, so posting every day for ${DAYS} days costs ${money(editor)}.`;
  const saved = (hasSmm ? editor + SMM_30_DAYS : editor) - total;
  const extra = cart[0] === 'full' ? ' You also get the bonus video and the private GBN AI Discord. GBN AI goes to $997 on Dec 31.' : '';
  return `${instead} You pay ${money(total)} once, so you save ${money(saved)} in the first ${DAYS} days.${extra} All sales are final, no refunds. Needs your own paid Claude plan.`;
}

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
const isCurrent = (l) => CARTS.some((c) => l.metadata.gbn_key === cartKey(c) && l.metadata.amount === String(cartTotal(c)));

async function setup() {
  const products = (await listAll('/products?active=true')).filter((p) => p.metadata && p.metadata.gbn_key);
  const prices = (await listAll('/prices?active=true')).filter((p) => p.metadata && p.metadata.gbn_key);
  const links = (await listAll('/payment_links')).filter((l) => l.metadata && l.metadata.gbn_key);
  const out = { products: {}, carts: {}, retired: [] };
  const keepPrices = new Set();
  const priceOf = {}; // "researcher" / "researcher@197" -> price id

  const findOrCreatePrice = async (product, key, amount, nickname) => {
    let price = prices.find((p) => p.metadata.gbn_key === key && p.unit_amount === amount && p.product === product.id);
    if (!price) {
      price = await stripe('POST', '/prices', {
        product: product.id, currency: 'usd', unit_amount: amount, nickname,
        metadata: { gbn_key: key },
      }, `gbn-price-${key}-${amount}`);
    }
    keepPrices.add(price.id);
    return price;
  };

  for (const [key, t] of Object.entries(TIERS)) {
    let product = products.find((p) => p.metadata.gbn_key === key);
    if (!product) {
      product = await stripe('POST', '/products', {
        name: t.name, description: t.description, type: 'service',
        metadata: { gbn_key: key, brand: 'GBN AI', created_by: 'vocreativeco.com' },
      }, `gbn-product-${key}`);
    } else if (product.name !== t.name || product.description !== t.description) {
      product = await stripe('POST', `/products/${product.id}`, { name: t.name, description: t.description });
    }
    priceOf[key] = (await findOrCreatePrice(product, key, t.price, `${t.name} ($${t.price / 100})`)).id;
    out.products[key] = { product: product.id, price: priceOf[key], amount: t.price / 100 };
    if (t.regular) {
      priceOf[`${key}@197`] = (await findOrCreatePrice(product, key, t.regular, `${t.name} ($${t.regular / 100}, regular)`)).id;
      out.products[key].regular = { price: priceOf[`${key}@197`], amount: t.regular / 100 };
    }
  }

  for (const cart of CARTS) {
    const key = cartKey(cart);
    const amount = cartTotal(cart);
    const message = savingsText(cart);
    const tiers = cart.map(base).join(',');
    let link = links.find((l) => l.metadata.gbn_key === key && l.metadata.amount === String(amount));
    if (!link) {
      const lineItems = {};
      cart.forEach((k, i) => { lineItems[i] = { price: priceOf[k], quantity: 1 }; });
      link = await stripe('POST', '/payment_links', {
        line_items: lineItems,
        after_completion: { type: 'redirect', redirect: { url: `${SITE}/ai/thanks/?t=${encodeURIComponent(cart.map(base).join('+'))}&session_id={CHECKOUT_SESSION_ID}` } },
        customer_creation: 'always',
        allow_promotion_codes: 'true',
        custom_text: { submit: { message } },
        metadata: { gbn_key: key, tiers, amount: String(amount) },
        payment_intent_data: { metadata: { gbn_key: key, tiers } },
      }, `gbn-cart-${key}-${amount}`);
      // New links start switched off; "activate" turns them on at launch.
      link = await stripe('POST', `/payment_links/${link.id}`, { active: 'false' });
    } else if (((link.custom_text || {}).submit || {}).message !== message) {
      link = await stripe('POST', `/payment_links/${link.id}`, { custom_text: { submit: { message } } });
    }
    out.carts[key] = { id: link.id, url: link.url, active: link.active, amount: amount / 100, tiers };
  }

  // Earlier price lists: links off, prices archived.
  for (const l of links) {
    if (isCurrent(l)) continue;
    if (l.active) await stripe('POST', `/payment_links/${l.id}`, { active: 'false' });
    out.retired.push(`link ${l.metadata.gbn_key} $${l.metadata.amount || '?'}`);
  }
  for (const p of prices) {
    if (keepPrices.has(p.id)) continue;
    await stripe('POST', `/prices/${p.id}`, { active: 'false' });
    out.retired.push(`price ${p.metadata.gbn_key} $${p.unit_amount / 100}`);
  }
  console.log(JSON.stringify(out, null, 2));
}

async function setActive(active) {
  const links = (await listAll('/payment_links')).filter((l) => l.metadata && l.metadata.gbn_key && isCurrent(l));
  for (const l of links) {
    if (l.active === active) continue;
    await stripe('POST', `/payment_links/${l.id}`, { active: String(active) });
    console.log(`${active ? 'on ' : 'off'} ${l.metadata.gbn_key} ${l.url}`);
  }
  console.log(`${links.length} GBN links are now ${active ? 'on' : 'off'}.`);
}

module.exports = { TIERS, CARTS, savingsText, cartKey, cartTotal };

if (require.main === module) {
  (async () => {
    const cmd = process.argv[2];
    if (!cmd) return setup();
    if (cmd === 'activate') return setActive(true);
    if (cmd === 'deactivate') return setActive(false);
    if (cmd === 'savings') return CARTS.forEach((c) => console.log(`${cartKey(c)} ($${cartTotal(c) / 100}): ${savingsText(c)}`));
    console.error('usage: (no args) | activate | deactivate | savings');
    process.exit(2);
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
