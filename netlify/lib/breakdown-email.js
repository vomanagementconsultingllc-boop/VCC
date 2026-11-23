// The email someone gets after asking for the free video on vocreativeco.com/free
// ("How I Built the AI Behind My 1.5 Million Views"). Sent through Resend by
// netlify/functions/submission-created.js (form "breakdown"). The video itself
// is on /free/watch/; this email links to it.

const SITE = 'https://vocreativeco.com';
const SUBJECT = 'Your free video: how I built my AI';
const PREHEADER = 'How I built the AI behind my 1.5 million views, and how you can build your own.';
const PAGE_URL = `${SITE}/free/`;
const MAILING_ADDRESS = '2929 Hannah Blvd, East Lansing, MI';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function watchUrl(first) {
  const q = new URLSearchParams({ src: 'email' });
  if (first) q.set('n', first);
  return `${SITE}/free/watch/?${q.toString()}`;
}

const INSIDE = [
  'The AI team I built in Claude, and what each one does',
  'How it edits a video while I approve the storyboard',
  'How you can build the same thing yourself',
];

// Returns { subject, html, text } for one person.
function buildBreakdownEmail({ name } = {}) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const hey = first ? `Hey ${first},` : 'Hey,';
  const link = watchUrl(first);

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(SUBJECT)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(PREHEADER)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
  <tr><td>
    <p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:#1a1a1a">${esc(hey)}</p>
    <h1 style="margin:0 0 14px;font:800 30px/1.1 ${FONT};letter-spacing:-.02em;color:#0a0a0a">Here&rsquo;s how I built the AI behind my 1.5&nbsp;million views.</h1>
    <p style="margin:0 0 14px;font:16px/1.6 ${FONT};color:#1a1a1a">In this video:</p>
    <ul style="margin:0 0 22px;padding-left:20px;font:16px/1.7 ${FONT};color:#1a1a1a">
      ${INSIDE.map((x) => `<li>${esc(x)}</li>`).join('\n      ')}
    </ul>
    <a href="${esc(link)}" style="display:inline-block;padding:15px 22px;background:#E8352B;border-radius:10px;font:700 16px/1 ${FONT};color:#ffffff;text-decoration:none">Watch the video &rarr;</a>
    <p style="margin:26px 0 4px;font:16px/1.6 ${FONT};color:#1a1a1a">Hit reply and tell me what you&rsquo;re trying to grow. I read every reply.</p>
    <p style="margin:18px 0 0;font:16px/1.6 ${FONT};color:#1a1a1a">Nathan</p>
  </td></tr>
  <tr><td style="padding:36px 0 0;border-bottom:1px solid #eeeeee"></td></tr>
  <tr><td style="padding:16px 0 0;font:12px/1.6 ${FONT};color:#8a8a8a">You&rsquo;re getting this because you asked for my free video at <a href="${PAGE_URL}" style="color:#8a8a8a">vocreativeco.com/free</a>.<br>Vo Creative Co. &middot; ${esc(MAILING_ADDRESS)}</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    hey,
    '',
    "Here's how I built the AI behind my 1.5 million views.",
    'In this video:',
    '',
    ...INSIDE.map((x) => `- ${x}`),
    '',
    'Watch it here:',
    link,
    '',
    "Hit reply and tell me what you're trying to grow. I read every reply.",
    '',
    'Nathan',
    '',
    '--',
    `You're getting this because you asked for my free video at ${PAGE_URL}`,
    `Vo Creative Co. · ${MAILING_ADDRESS}`,
  ].join('\n');

  return { subject: SUBJECT, html, text };
}

module.exports = { buildBreakdownEmail };
