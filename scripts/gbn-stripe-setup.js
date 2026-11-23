#!/usr/bin/env node
// GBN AI offer in Stripe: products, prices and payment links. Safe to re-run:
// everything is found by metadata first, and creates use idempotency keys.
//
// The offer (Nathan, Nov 23, 2026):
//   - The landing page sells one thing: the AI Video Editor, $97.
//   - The checkout step (/ai/checkout/) offers the other 3 as add-ons:
//     Viral Video Researcher $37, Social Media Manager $37, AI Outreach System $69.
//   - Adding any of them offers GBN AI (all 4 + a bonus video) for $179 instead.
//     A cart over $179 always goes to GBN AI, since it's cheaper and includes more.
//   - Launch prices end Dec 30, 2026; after that every price doubles.
// So there is one payment link per cart the checkout page can send people to.
//
//   node scripts/gbn-stripe-setup.js            create/find everything, retire old links and prices, print ids
//   node scripts/gbn-stripe-setup.js activate   switch the current links on
//   node scripts/gbn-stripe-setup.js deactivate switch the current links off
//
// In Claude cloud sessions the proxy fills in the Stripe key:
//   STRIPE_KEY=proxy-injected NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/gbn-stripe-setup.js

const KEY = process.env.STRIPE_KEY || 'proxy-injected';
const SITE = 'https://vocreativeco.com';

const TIERS = {
  editor: { name: 'AI Video Editor', price: 9700,
    description: 'Claude video editors for every style: quick cut, full edit, dead-space cut, green screen and news. It storyboards first, then hands you a finished vertical video.' },
  researcher: { name: 'Viral Video Researcher', price: 3700,
    description: 'A Claude research agent that finds short-form videos blowing up in your niche, breaks down why they worked, and turns them into ready-to-film ideas with hooks.' },
  social: { name: 'Social Media Manager', price: 3700,
    description: 'A Claude social media manager that briefs every post and keeps your calendar, with a content coach that checks how every video did and tells you what to fix.' },
  outreach: { name: 'AI Outreach System', price: 6900,
    description: 'A Claude outreach system that builds your lead list, scores every lead, writes personal first messages in your voice and tracks each follow-up in one sheet.' },
  full: { name: 'GBN AI: the full Claude team', price: 17900,
    description: 'All 4 systems: the AI Video Editor, Viral Video Researcher, Social Media Manager and AI Outreach System. Bonus: my video on using it to make content that goes viral.' },
};

// The carts /ai/checkout/ can send people to. Keys are the link's gbn_key.
const CARTS = [
  ['editor'],
  ['editor', 'researcher'],
  ['editor', 'social'],
  ['editor', 'outreach'],
  ['editor', 'researcher', 'social'],
  ['full'],
];
const cartKey = (cart) => cart.join('+');
const cartTotal = (cart) => cart.reduce((n, k) => n + TIERS[k].price, 0);

// What hiring each job out costs: Upwork's published hourly rates (Nov 2026)
// at 10 hours a month. Shown at checkout above the Pay button.
const HIRE = {
  editor: { role: 'video editor', rate: [10, 60] },
  researcher: { role: 'content strategist', rate: [35, 65] },
  social: { role: 'social media manager', rate: [14, 35] },
  outreach: { role: 'lead generation specialist', rate: [13, 45] },
};
const money = (n) => `$${n.toLocaleString('en-US')}`;

function savingsText(cart) {
  const tiers = cart[0] === 'full' ? ['editor', 'researcher', 'social', 'outreach'] : cart;
  const low = tiers.reduce((n, k) => n + HIRE[k].rate[0] * 10, 0);
  const high = tiers.reduce((n, k) => n + HIRE[k].rate[1] * 10, 0);
  const total = money(cartTotal(cart) / 100);
  const roles = tiers.map((k) => HIRE[k].role);
  const bonus = cart[0] === 'full' ? ', plus the bonus video' : '';
  const end = `This is ${total} once${bonus}. Launch price until Dec 30, then it doubles. Needs your own paid Claude plan.`;
  if (roles.length === 1) {
    const h = HIRE[tiers[0]];
    return `What you save: a freelance ${h.role} on Upwork charges about $${h.rate[0]} to $${h.rate[1]} an hour. Just 10 hours a month is ${money(low)} to ${money(high)} a month. ${end}`;
  }
  const list = `${roles.slice(0, -1).join(', ')}${roles.length > 2 ? ',' : ''} and ${roles[roles.length - 1]}`;
  return `What you save: hiring a ${list} on Upwork for just 10 hours a month each costs about ${money(low)} to ${money(high)} a month. ${end}`;
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
  const priceOf = {};

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
    let price = prices.find((p) => p.metadata.gbn_key === key && p.unit_amount === t.price && p.product === product.id);
    if (!price) {
      price = await stripe('POST', '/prices', {
        product: product.id, currency: 'usd', unit_amount: t.price, nickname: `${t.name} ($${t.price / 100})`,
        metadata: { gbn_key: key },
      }, `gbn-price-${key}-${t.price}`);
    }
    keepPrices.add(price.id);
    priceOf[key] = price.id;
    out.products[key] = { product: product.id, price: price.id, amount: t.price / 100 };
  }

  for (const cart of CARTS) {
    const key = cartKey(cart);
    const amount = cartTotal(cart);
    const message = savingsText(cart);
    let link = links.find((l) => l.metadata.gbn_key === key && l.metadata.amount === String(amount));
    if (!link) {
      const lineItems = {};
      cart.forEach((k, i) => { lineItems[i] = { price: priceOf[k], quantity: 1 }; });
      link = await stripe('POST', '/payment_links', {
        line_items: lineItems,
        after_completion: { type: 'redirect', redirect: { url: `${SITE}/ai/thanks/?t=${encodeURIComponent(key)}&session_id={CHECKOUT_SESSION_ID}` } },
        customer_creation: 'always',
        allow_promotion_codes: 'true',
        custom_text: { submit: { message } },
        metadata: { gbn_key: key, tiers: cart.join(','), amount: String(amount) },
        payment_intent_data: { metadata: { gbn_key: key, tiers: cart.join(',') } },
      }, `gbn-cart-${key}-${amount}`);
      // New links start switched off; "activate" turns them on at launch.
      link = await stripe('POST', `/payment_links/${link.id}`, { active: 'false' });
    } else if (((link.custom_text || {}).submit || {}).message !== message) {
      link = await stripe('POST', `/payment_links/${link.id}`, { custom_text: { submit: { message } } });
    }
    out.carts[key] = { id: link.id, url: link.url, active: link.active, amount: amount / 100, savings: message };
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

module.exports = { TIERS, CARTS, HIRE, savingsText, cartKey, cartTotal };

if (require.main === module) {
  (async () => {
    const cmd = process.argv[2];
    if (!cmd) return setup();
    if (cmd === 'activate') return setActive(true);
    if (cmd === 'deactivate') return setActive(false);
    if (cmd === 'savings') return CARTS.forEach((c) => console.log(`${cartKey(c)}: ${savingsText(c)}`));
    console.error('usage: (no args) | activate | deactivate | savings');
    process.exit(2);
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
