// Copies every verified Netlify Forms submission into the
// "Vo Creative Studio · Signups" Google Sheet.
//
// Netlify runs this automatically after each form submission (a function named
// "submission-created" is triggered by that event). It posts the row to a small
// Google Apps Script web app that lives inside the Sheet.
//
// Needs two environment variables on the Netlify site:
//   SHEETS_WEBHOOK_URL  the Apps Script web app URL (ends in /exec)
//   SHEETS_TOKEN        shared secret; must match TOKEN in the Apps Script
// If either is missing the function does nothing, so signups are never blocked.

const TABS = { 'studio-waitlist': 'Waitlist', booking: 'Booking' };

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

exports.handler = async (event) => {
  const url = process.env.SHEETS_WEBHOOK_URL;
  const token = process.env.SHEETS_TOKEN;
  if (!url || !token) {
    console.log('Google Sheets sync is not configured; skipping.');
    return { statusCode: 200, body: 'not configured' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body).payload || {};
  } catch (err) {
    console.error('Could not read the submission payload:', err.message);
    return { statusCode: 200, body: 'bad payload' };
  }

  const data = payload.data || {};
  const form = payload.form_name || data['form-name'] || 'Other';
  const tab = TABS[form] || form;
  const row = rowFor(form, data, detroitTime(payload.created_at || Date.now()));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, tab, row }),
    });
    const text = await res.text();
    console.log(`Google Sheets (${tab}):`, res.status, text.slice(0, 200));
  } catch (err) {
    console.error('Google Sheets sync failed:', err.message);
  }
  // Always 200: a Sheets hiccup must never affect the signup itself.
  return { statusCode: 200, body: 'ok' };
};
