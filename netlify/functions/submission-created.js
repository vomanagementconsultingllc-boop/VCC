// Runs automatically after every verified Netlify Forms submission (a function
// named "submission-created" is triggered by that event) and copies the signup to:
//
// 1. Kit (email):
//    - "prompts" signups are added to the prompts form, whose incentive email
//      delivers the prompts, and tagged "AI Prompts".
//    - "waitlist" answers are saved as custom fields and tagged "Studio Waitlist".
//    Needs KIT_API_KEY (a Kit V4 API key) on the Netlify site.
//
// 2. The "Vo Creative Studio · Signups" Google Sheet, via a small Apps Script web
//    app inside the Sheet. Needs SHEETS_WEBHOOK_URL and SHEETS_TOKEN.
//
// Each part is skipped when its settings are missing, and errors are only logged,
// so a problem here can never block a signup.

const TABS = { prompts: 'Prompts', waitlist: 'Studio Waitlist', 'studio-waitlist': 'Waitlist', booking: 'Booking' };

function detroitTime(value) {
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'America/Detroit',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// "utm_source=ig&utm_medium=social&fbclid=..." -> "ig / social"
function tidySource(source) {
  if (!source || source === 'direct') return source || '';
  const q = new URLSearchParams(source);
  const parts = ['src', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
    .map((k) => q.get(k))
    .filter(Boolean);
  return parts.length ? parts.join(' / ') : source.slice(0, 120);
}

function rowFor(form, d, submitted) {
  const v = (key) => (d[key] == null ? '' : String(d[key]));
  if (form === 'prompts') {
    return { 'Submitted': submitted, 'Name': v('name'), 'Email': v('email'), 'Source': tidySource(v('source')) };
  }
  if (form === 'waitlist') {
    return {
      'Submitted': submitted,
      'Name': v('name'),
      'Email': v('email'),
      'Why post content': v('why'),
      'Content they want to post': v('content'),
      'Struggling with': v('struggle'),
      'Wants from the studio': v('help'),
      'Source': tidySource(v('source')),
    };
  }
  if (form === 'studio-waitlist') {
    return {
      'Submitted': submitted,
      'Name': v('name'),
      'Email': v('email'),
      'Phone': v('phone'),
      'Texts & emails OK': v('marketing_opt_in') || 'no',
      'Button clicked': v('cta'),
      'Source': tidySource(v('source')),
      'Consent wording': v('consent_language'),
    };
  }
  if (form === 'booking') {
    return {
      'Submitted': submitted,
      'Name': v('name'),
      'Email': v('email'),
      'Phone': v('phone'),
      'Service': v('service'),
      'Business': v('business'),
      'Website': v('website'),
      'Monthly revenue': v('revenue'),
      'Timeframe': v('timeframe'),
      'About': v('about'),
    };
  }
  // Any other form: every field it sent, minus technical ones.
  const skip = new Set(['form-name', 'bot-field', 'ip', 'user_agent', 'referrer']);
  const row = { 'Submitted': submitted };
  Object.keys(d).forEach((k) => { if (!skip.has(k)) row[k] = v(k); });
  return row;
}

// ---- Kit -----------------------------------------------------------------
const KIT_API = process.env.KIT_API_BASE || 'https://api.kit.com/v4';
const KIT = {
  promptsFormId: Number(process.env.KIT_PROMPTS_FORM_ID || 10176738),
  tags: { prompts: 25731927, waitlist: 25731928 },
  // Kit custom field keys for the four studio waitlist answers
  fields: { why: 'why_post_content', content: 'content_they_want_to_post', struggle: 'struggling_with', help: 'wants_from_the_studio' },
};

async function kit(path, body) {
  const res = await fetch(KIT_API + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Kit-Api-Key': process.env.KIT_API_KEY,
    },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Kit ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

async function sendToKit(form, d) {
  if (!process.env.KIT_API_KEY) return 'Kit not configured; skipped.';
  const email = String(d.email || '').trim();
  if (!email) return 'No email; skipped Kit.';
  const firstName = String(d.name || '').trim();

  if (form === 'prompts') {
    // Create (or update) the subscriber, tag them, then add them to the prompts
    // form; the form's incentive email delivers the prompts.
    const { subscriber } = await kit('/subscribers', { email_address: email, ...(firstName && { first_name: firstName }) });
    await kit(`/tags/${KIT.tags.prompts}/subscribers/${subscriber.id}`);
    await kit(`/forms/${KIT.promptsFormId}/subscribers/${subscriber.id}`);
    return `Kit: ${email} added to the prompts form and tagged AI Prompts.`;
  }
  if (form === 'waitlist') {
    const fields = {};
    Object.keys(KIT.fields).forEach((k) => { if (d[k]) fields[KIT.fields[k]] = String(d[k]); });
    const { subscriber } = await kit('/subscribers', { email_address: email, ...(firstName && { first_name: firstName }), fields });
    await kit(`/tags/${KIT.tags.waitlist}/subscribers/${subscriber.id}`);
    return `Kit: ${email} tagged Studio Waitlist with their answers.`;
  }
  return `Kit: nothing to do for form "${form}".`;
}

// ---- Google Sheets ----------------------------------------------------------
async function sendToSheet(form, data, createdAt) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  const token = process.env.SHEETS_TOKEN;
  if (!url || !token) return 'Google Sheets not configured; skipped.';
  const tab = TABS[form] || form;
  const row = rowFor(form, data, detroitTime(createdAt || Date.now()));
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, tab, row }),
  });
  const text = await res.text();
  return `Google Sheets (${tab}): ${res.status} ${text.slice(0, 200)}`;
}

exports.handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body).payload || {};
  } catch (err) {
    console.error('Could not read the submission payload:', err.message);
    return { statusCode: 200, body: 'bad payload' };
  }

  const data = payload.data || {};
  const form = payload.form_name || data['form-name'] || 'Other';

  const results = await Promise.allSettled([
    sendToKit(form, data),
    sendToSheet(form, data, payload.created_at),
  ]);
  results.forEach((r) => (r.status === 'fulfilled' ? console.log(r.value) : console.error(r.reason && r.reason.message)));

  // Always 200: a Kit or Sheets hiccup must never affect the signup itself.
  return { statusCode: 200, body: 'ok' };
};
