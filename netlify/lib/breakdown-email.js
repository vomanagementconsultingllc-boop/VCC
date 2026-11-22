// The email someone gets after asking for the 78K video breakdown on
// vocreativeco.com/78k. Sent through Resend by netlify/functions/submission-created.js.
// The breakdown itself is the page /78k/read/; this email links to it.

const SITE = 'https://vocreativeco.com';
const SUBJECT = 'Your 78K video breakdown';
const PREHEADER = 'The real post, the real numbers, and the Claude team behind it.';
const PAGE_URL = `${SITE}/78k/`;
const MAILING_ADDRESS = '2929 Hannah Blvd, East Lansing, MI';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function readUrl(first) {
  const q = new URLSearchParams({ src: 'email' });
  if (first) q.set('n', first);
  return `${SITE}/78k/read/?${q.toString()}`;
}

const INSIDE = [
  'The post and its real Instagram numbers',
  'The 4 videos I posted that same morning, and how far apart they landed',
  'How my Claude team makes a video now, step by step',
  '5 rules from 1,000 hours in Claude',
];

// Returns { subject, html, text } for one person.
function buildBreakdownEmail({ name } = {}) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const hey = first ? `Hey ${first},` : 'Hey,';
  const link = readUrl(first);

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(SUBJECT)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(PREHEADER)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
  <tr><td>
    <p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:#1a1a1a">${esc(hey)}</p>
    <h1 style="margin:0 0 14px;font:800 30px/1.1 ${FONT};letter-spacing:-.02em;color:#0a0a0a">Here&rsquo;s how my AI made a 78K&#8209;view video in 2&nbsp;minutes.</h1>
    <p style="margin:0 0 14px;font:16px/1.6 ${FONT};color:#1a1a1a">78,829 views, 1,131 saves and 567 shares on one reel. Here&rsquo;s what&rsquo;s in the breakdown:</p>
    <ul style="margin:0 0 22px;padding-left:20px;font:16px/1.7 ${FONT};color:#1a1a1a">
      ${INSIDE.map((x) => `<li>${esc(x)}</li>`).join('\n      ')}
    </ul>
    <a href="${esc(link)}" style="display:inline-block;padding:15px 22px;background:#0a0a0a;border-radius:10px;font:700 16px/1 ${FONT};color:#ffffff;text-decoration:none">Read the breakdown &rarr;</a>
    <p style="margin:26px 0 4px;font:16px/1.6 ${FONT};color:#1a1a1a">Hit reply and tell me what you&rsquo;re trying to grow. I read every reply.</p>
    <p style="margin:18px 0 0;font:16px/1.6 ${FONT};color:#1a1a1a">Nathan</p>
  </td></tr>
  <tr><td style="padding:36px 0 0;border-bottom:1px solid #eeeeee"></td></tr>
  <tr><td style="padding:16px 0 0;font:12px/1.6 ${FONT};color:#8a8a8a">You&rsquo;re getting this because you asked for my 78K video breakdown at <a href="${PAGE_URL}" style="color:#8a8a8a">vocreativeco.com/78k</a>.<br>Vo Creative Co. &middot; ${esc(MAILING_ADDRESS)}</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    hey,
    '',
    "Here's how my AI made a 78K-view video in 2 minutes.",
    "78,829 views, 1,131 saves and 567 shares on one reel. Here's what's in the breakdown:",
    '',
    ...INSIDE.map((x) => `- ${x}`),
    '',
    'Read it here:',
    link,
    '',
    "Hit reply and tell me what you're trying to grow. I read every reply.",
    '',
    'Nathan',
    '',
    '--',
    `You're getting this because you asked for my 78K video breakdown at ${PAGE_URL}`,
    `Vo Creative Co. · ${MAILING_ADDRESS}`,
  ].join('\n');

  return { subject: SUBJECT, html, text };
}

module.exports = { buildBreakdownEmail };
