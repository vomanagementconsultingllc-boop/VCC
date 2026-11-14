// The email someone gets after asking for the prompts on vocreativeco.com/studio.
// Sent through Resend by netlify/functions/submission-created.js.
//
// To change what the email says, edit PROMPTS and the copy below.
// Until all three prompts have text, the email is not sent (see promptsReady).

const PROMPTS = [
  { title: 'My AI Video Editor', body: '' },
  { title: 'My Viral Video Researcher', body: '' },
  { title: 'AI Outreach System', body: '' },
];

const SUBJECT = 'Your 3 AI prompts';
const PREHEADER = 'My AI Video Editor, Viral Video Researcher and Outreach System.';
const PAGE_URL = 'https://vocreativeco.com/studio/';

function promptsReady() {
  return PROMPTS.every((p) => p.body.trim().length > 0);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function promptBlock(p, i) {
  return `
  <tr><td style="padding:28px 0 0">
    <p style="margin:0 0 4px;font:700 11px/1.4 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:#6b6b6b">Prompt 0${i + 1}</p>
    <h2 style="margin:0 0 12px;font:800 22px/1.2 ${FONT};color:#0a0a0a">${esc(p.title)}</h2>
    <div style="padding:16px 18px;background:#f6f6f6;border:1px solid #e6e6e6;border-radius:12px;font:14px/1.6 ${MONO};color:#1a1a1a;white-space:pre-wrap;word-break:break-word">${esc(p.body.trim())}</div>
  </td></tr>`;
}

// Returns { subject, html, text } for one person, or null if the prompts
// have no text yet.
function buildPromptsEmail({ name } = {}) {
  if (!promptsReady()) return null;
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const hey = first ? `Hey ${first},` : 'Hey,';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(SUBJECT)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(PREHEADER)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
  <tr><td>
    <p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:#1a1a1a">${esc(hey)}</p>
    <h1 style="margin:0 0 14px;font:800 30px/1.1 ${FONT};letter-spacing:-.02em;color:#0a0a0a">Here are the 3 AI prompts behind my 1.5&nbsp;million views.</h1>
    <p style="margin:0;font:16px/1.6 ${FONT};color:#1a1a1a">Copy any of them into ChatGPT or Claude, fill in the parts in [brackets], and run it.</p>
  </td></tr>
  ${PROMPTS.map(promptBlock).join('')}
  <tr><td style="padding:32px 0 0">
    <p style="margin:0 0 14px;font:16px/1.6 ${FONT};color:#1a1a1a"><b>Want me to walk you through it?</b> I&rsquo;m building a community where I set these up with you, step by step. Reply <b>&ldquo;studio&rdquo;</b> and I&rsquo;ll save you a spot on the waitlist for my creative studio.</p>
    <p style="margin:0 0 4px;font:16px/1.6 ${FONT};color:#1a1a1a">Hit reply and tell me which one you&rsquo;re trying first. I read every reply.</p>
    <p style="margin:18px 0 0;font:16px/1.6 ${FONT};color:#1a1a1a">Nathan</p>
  </td></tr>
  <tr><td style="padding:36px 0 0;border-bottom:1px solid #eeeeee"></td></tr>
  <tr><td style="padding:16px 0 0;font:12px/1.6 ${FONT};color:#8a8a8a">You&rsquo;re getting this because you asked for my prompts at <a href="${PAGE_URL}" style="color:#8a8a8a">vocreativeco.com/studio</a>.<br>Vo Creative Studio &middot; Detroit, Michigan</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    hey,
    '',
    'Here are the 3 AI prompts behind my 1.5 million views.',
    'Copy any of them into ChatGPT or Claude, fill in the parts in [brackets], and run it.',
    '',
    ...PROMPTS.flatMap((p, i) => [`PROMPT 0${i + 1}: ${p.title.toUpperCase()}`, '', p.body.trim(), '', '']),
    'Want me to walk you through it? I\'m building a community where I set these up with you, step by step. Reply "studio" and I\'ll save you a spot on the waitlist for my creative studio.',
    '',
    "Hit reply and tell me which one you're trying first. I read every reply.",
    '',
    'Nathan',
    '',
    '--',
    `You're getting this because you asked for my prompts at ${PAGE_URL}`,
    'Vo Creative Studio · Detroit, Michigan',
  ].join('\n');

  return { subject: SUBJECT, html, text };
}

module.exports = { buildPromptsEmail, promptsReady, PROMPTS };
