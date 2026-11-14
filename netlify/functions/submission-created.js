// Runs automatically after every verified Netlify Forms submission (a function
// named "submission-created" is triggered by that event) and copies the signup to:
//
// 1. Resend (email):
//    - "prompts" signups get the prompts email (netlify/lib/prompts-email.js).
//    - "prompts" and "waitlist" signups are saved as Resend contacts.
//    Needs RESEND_API_KEY on the Netlify site; vocreativeco.com must be a
//    verified domain in Resend.
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

// ---- Resend (email) ---------------------------------------------------------
// "prompts" signups get the prompts email (netlify/lib/prompts-email.js) and are
// saved as a Resend contact. "waitlist" signups are saved as a contact too; their
// answers stay in Netlify Forms and the Google Sheet.
const { buildPromptsEmail } = require('../lib/prompts-email.js');

const RESEND_API = process.env.RESEND_API_BASE || 'https://api.resend.com';
const FROM = process.env.RESEND_FROM || 'Nathan Vo <nathan@vocreativeco.com>';
const REPLY_TO = process.env.RESEND_REPLY_TO || 'nathan@vocreativeco.com';

async function resend(method, path, body, idempotencyKey) {
  const headers = {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(RESEND_API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Resend ${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

// Add the person to Resend contacts (or update their first name if they're
// already there), so they can get a broadcast when the studio opens.
async function saveContact(email, firstName) {
  const contact = { email, unsubscribed: false, ...(firstName && { first_name: firstName }) };
  try {
    await resend('POST', '/contacts', contact);
    return 'contact added';
  } catch (err) {
    if (err.status !== 409 && err.status !== 422) throw err;
    if (firstName) await resend('PATCH', `/contacts/${encodeURIComponent(email)}`, { first_name: firstName });
    return 'contact already saved';
  }
}

async function sendWithResend(form, d, submissionId) {
  if (!process.env.RESEND_API_KEY) return 'Resend not configured; skipped.';
  if (form !== 'prompts' && form !== 'waitlist') return `Resend: nothing to do for form "${form}".`;
  const email = String(d.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'No valid email; skipped Resend.';
  const firstName = String(d.name || '').trim().split(/\s+/)[0] || '';
  const done = [];

  if (form === 'prompts') {
    const msg = buildPromptsEmail({ name: firstName });
    if (!msg) {
      done.push('prompts email has no prompt text yet, not sent');
    } else {
      const sent = await resend('POST', '/emails', {
        from: FROM,
        to: [email],
        reply_to: REPLY_TO,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        tags: [{ name: 'form', value: 'prompts' }],
      }, submissionId ? `prompts-${submissionId}` : undefined);
      done.push(`prompts email sent (${sent.id})`);
    }
  }

  try {
    done.push(await saveContact(email, firstName));
  } catch (err) {
    done.push(`contact not saved: ${err.message}`);
  }
  return `Resend (${form}) ${email}: ${done.join('; ')}.`;
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
    sendWithResend(form, data, payload.id),
    sendToSheet(form, data, payload.created_at),
  ]);
  results.forEach((r) => (r.status === 'fulfilled' ? console.log(r.value) : console.error(r.reason && r.reason.message)));

  // Always 200: an email or Sheets hiccup must never affect the signup itself.
  return { statusCode: 200, body: 'ok' };
};
