// The email someone gets after asking for the prompts on vocreativeco.com/studio.
// Sent through Resend by netlify/functions/submission-created.js.
//
// Each prompt is a setup guide (a PDF in studio/p/) that the email links to.
// To change what the email says, edit PROMPTS and the copy below.

const SITE = 'https://vocreativeco.com';

const PROMPTS = [
  {
    title: 'My AI Video Editor',
    blurb: 'Turns a raw talking-head video into a finished vertical short: tight cuts, title, captions and real screenshots, checked by itself before you see it.',
    url: `${SITE}/studio/p/ai-video-editor-setup-prompts.pdf`,
  },
  {
    title: 'My Viral Video Researcher',
    blurb: 'Finds the short-form videos that outperformed in your niche, logs every hook to a Google Sheet, and turns the patterns into ideas you can film.',
    url: `${SITE}/studio/p/viral-research-system-setup-prompts.pdf`,
  },
  {
    title: 'AI Outreach System',
    blurb: 'Pulls a list of local businesses, scores each one against your ideal client, writes first messages in your voice, and tracks every follow-up.',
    url: `${SITE}/studio/p/outreach-system-setup-prompts.pdf`,
  },
];

const SUBJECT = 'Your 3 AI prompts';
const PREHEADER = 'My AI Video Editor, Viral Video Researcher and Outreach System.';
const PAGE_URL = `${SITE}/studio/`;

// The Discord button opens the questions on the page, already knowing who the
// person is (?join=...). After question 4 the page shows the invite link.
// The token is just base64url JSON of their email and first name (not a secret,
// it only saves them retyping); studio/index.html reads it.
function joinUrl(email, first) {
  if (!email) return `${PAGE_URL}?src=email`;
  const token = Buffer.from(JSON.stringify({ e: email, n: first || '' }), 'utf8').toString('base64url');
  return `${PAGE_URL}?join=${token}&src=email`;
}

function promptsReady() {
  return PROMPTS.every((p) => /^https:\/\//.test(p.url || ''));
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function promptBlock(p, i) {
  return `
  <tr><td style="padding:16px 0 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e6e6;border-radius:14px;background:#fafafa"><tr><td style="padding:20px 20px 22px">
      <p style="margin:0 0 4px;font:700 11px/1.4 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:#6b6b6b">Prompt 0${i + 1}</p>
      <h2 style="margin:0 0 8px;font:800 22px/1.2 ${FONT};color:#0a0a0a">${esc(p.title)}</h2>
      <p style="margin:0 0 16px;font:15px/1.55 ${FONT};color:#3a3a3a">${esc(p.blurb)}</p>
      <a href="${esc(p.url)}" style="display:inline-block;padding:13px 20px;background:#0a0a0a;border-radius:10px;font:700 15px/1 ${FONT};color:#ffffff;text-decoration:none">Open the setup prompts &rarr;</a>
    </td></tr></table>
  </td></tr>`;
}

// Returns { subject, html, text } for one person, or null if a prompt has no link.
function buildPromptsEmail({ name, email } = {}) {
  if (!promptsReady()) return null;
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const discordLink = joinUrl(String(email || '').trim(), first);
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
    <p style="margin:0 0 8px;font:16px/1.6 ${FONT};color:#1a1a1a">Each one is a short set of copy-and-paste prompts that builds the system inside Claude. Run them in order in one chat and fill in the parts in [brackets].</p>
  </td></tr>
  ${PROMPTS.map(promptBlock).join('')}
  <tr><td style="padding:32px 0 0">
    <h2 style="margin:0 0 8px;font:800 22px/1.2 ${FONT};color:#0a0a0a">Don&rsquo;t build it alone.</h2>
    <p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:#1a1a1a">Join my free Discord. Ask me anything in #ask-nathan, get help in the thread for each system, see my full tech stack and new AI tool drops, and show off what you built.</p>
    <a href="${esc(discordLink)}" style="display:inline-block;padding:15px 22px;background:#5865F2;border-radius:10px;font:700 16px/1 ${FONT};color:#ffffff;text-decoration:none">Join the free Discord &rarr;</a>
    <p style="margin:10px 0 0;font:14px/1.5 ${FONT};color:#6b6b6b">Answer 4 quick questions, then you get the invite link.</p>
    <p style="margin:24px 0 4px;font:16px/1.6 ${FONT};color:#1a1a1a">Hit reply and tell me which one you&rsquo;re trying first. I read every reply.</p>
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
    'Each one is a short set of copy-and-paste prompts that builds the system inside Claude. Run them in order in one chat and fill in the parts in [brackets].',
    '',
    ...PROMPTS.flatMap((p, i) => [`PROMPT 0${i + 1}: ${p.title.toUpperCase()}`, p.blurb, p.url, '']),
    "DON'T BUILD IT ALONE",
    'Join my free Discord. Ask me anything in #ask-nathan, get help in the thread for each system, see my full tech stack and new AI tool drops, and show off what you built.',
    'Answer 4 quick questions, then you get the invite link:',
    discordLink,
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
