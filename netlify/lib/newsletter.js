// The weekly VCC update newsletter, built from Nathan's layout (Nov 18, 2026):
//
//   Subject:   VCC update, [date]
//   Summary:   [main progress] and [biggest concern]
//   Metrics:   people joining the Discord, [prior] to [current]
//   Progress:  what shipped / what a pilot proved, screenshots, 3-4 story cards
//              (1-2 sentences each)
//   Challenge: [issue]. Our response: [action + date]
//   Ask:       an intro to [buyer role] at [organization] for [problem]
//   How I did it: how the AI systems got this week's results
//   Next:      [milestone]
//
// Each week's content comes from that week's video (Content / Finished /
// weekly video) and from Nathan. Only his words and Story Bank facts: anything
// not known yet stays a [FILL IN: ...] and the issue can't be sent until it's
// replaced. Brand: red #E8352B with black and white, General Sans for titles
// (uppercase), Sentient for body text (7 Brand sheet).

const SITE = 'https://vocreativeco.com';
const DISCORD_URL = 'https://discord.gg/jSfpvGcPmA';
const RED = '#E8352B';
const TITLE = "'General Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const BODY = "'Sentient', Georgia, 'Times New Roman', serif";
const FONTS_CSS = 'https://api.fontshare.com/v2/css?f[]=general-sans@600,700&f[]=sentient@400,500&display=swap';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const FILL = (what) => `[FILL IN: ${what}]`;
const val = (v, what) => (v == null || String(v).trim() === '' ? FILL(what) : String(v));

function hasFillIn(html) {
  return html.includes('[FILL IN');
}

function label(text) {
  return `<p style="margin:0 0 8px;font:700 12px/1.3 ${TITLE};letter-spacing:.16em;text-transform:uppercase;color:${RED}">${esc(text)}</p>`;
}
function para(text, style = '') {
  return `<p style="margin:0 0 14px;font:400 17px/1.6 ${BODY};color:#111111;${style}">${esc(text)}</p>`;
}
function section(inner) {
  return `<tr><td style="padding:26px 0 0">${inner}</td></tr>`;
}
function button(text, href, bg = '#000000') {
  return `<a href="${esc(href)}" style="display:inline-block;padding:14px 20px;background:${bg};border-radius:10px;font:700 15px/1.2 ${TITLE};letter-spacing:.04em;text-transform:uppercase;color:#ffffff;text-decoration:none">${esc(text)}</a>`;
}

// issue = {
//   date: 'Nov 22',
//   summary: { progress, concern },
//   metrics: { prior, current, note },             // people in the Discord
//   progress: { title, screenshots: [{ src, alt }], cards: ['1-2 sentences', ...] },
//   challenge: { issue, response, date },
//   ask: { role, org, problem },
//   howIDidIt: ['step', ...],
//   next: 'milestone',
//   videoUrl: 'link to the post',
// }
// Required every week: date, summary.progress, metrics.current, progress.title,
// at least one story card, at least one "How I did it" step, and the mailing
// address. Optional (left out when the video doesn't cover them, never made
// up): summary.concern, metrics.prior, screenshots, challenge, ask, next.
function renderNewsletter(issue = {}, { mailingAddress } = {}) {
  const s = issue.summary || {};
  const m = issue.metrics || {};
  const p = issue.progress || {};
  const c = issue.challenge || {};
  const a = issue.ask || {};
  const has = (v) => v != null && String(v).trim() !== '';
  const how = issue.howIDidIt && issue.howIDidIt.length ? issue.howIDidIt : [FILL('how you used your AI systems this week, step by step')];
  const cards = p.cards && p.cards.length ? p.cards.slice(0, 4) : [FILL('story card 1'), FILL('story card 2'), FILL('story card 3')];
  const shots = p.screenshots || [];

  const subject = `VCC update, ${val(issue.date, 'date')}`;
  const summary = `${val(s.progress, 'main progress')}${has(s.concern) ? ` and ${s.concern}` : ''}.`.replace(/\.\.$/, '.');

  const metricsBox = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;border-radius:16px"><tr><td style="padding:22px 22px 20px">
      <p style="margin:0 0 6px;font:700 12px/1.3 ${TITLE};letter-spacing:.16em;text-transform:uppercase;color:#ffffff">People in the Discord</p>
      <p style="margin:0;font:700 44px/1.05 ${TITLE};color:#ffffff">${has(m.prior) ? `${esc(m.prior)} <span style="color:${RED}">&rarr;</span> ` : ''}<span style="color:${RED}">${esc(val(m.current, 'this week'))}</span></p>
      ${m.note ? `<p style="margin:10px 0 0;font:400 15px/1.5 ${BODY};color:#d9d9d9">${esc(m.note)}</p>` : ''}
    </td></tr></table>`;

  const shotHtml = shots.map((img) => `<p style="margin:0 0 14px"><img src="${esc(img.src.startsWith('http') ? img.src : `${SITE}/${img.src}`)}" alt="${esc(img.alt || '')}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:1px solid #e6e6e6;border-radius:14px"></p>`).join('');

  const cardHtml = cards.map((t, i) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;border:1px solid #e6e6e6;border-left:4px solid ${RED};border-radius:12px;background:#fafafa"><tr><td style="padding:14px 16px">
        <p style="margin:0 0 4px;font:700 11px/1.3 ${TITLE};letter-spacing:.14em;text-transform:uppercase;color:#6b6b6b">Story ${i + 1}</p>
        <p style="margin:0;font:400 16px/1.55 ${BODY};color:#111111">${esc(t)}</p>
      </td></tr></table>`).join('');

  const howHtml = `<ol style="margin:0 0 6px;padding-left:22px;font:400 17px/1.6 ${BODY};color:#111111">${how.map((h) => `<li style="margin:0 0 8px">${esc(h)}</li>`).join('')}</ol>`;

  const challengeHtml = has(c.issue) ? section(`${label('Challenge')}${para(c.issue)}${has(c.response) ? `<p style="margin:0 0 14px;font:400 17px/1.6 ${BODY};color:#111111"><b style="font-family:${TITLE};text-transform:uppercase;letter-spacing:.04em;font-size:14px">Our response:</b> ${esc(c.response)}${has(c.date) ? ` (${esc(c.date)})` : ''}.</p>` : ''}`) : '';
  const askHtml = has(a.role) && has(a.problem) ? section(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${RED};border-radius:16px"><tr><td style="padding:20px 22px">
      <p style="margin:0 0 8px;font:700 12px/1.3 ${TITLE};letter-spacing:.16em;text-transform:uppercase;color:#ffffff">Ask</p>
      <p style="margin:0 0 12px;font:500 18px/1.5 ${BODY};color:#ffffff">Can you introduce me to ${esc(a.role)}${has(a.org) ? ` at ${esc(a.org)}` : ''}? I&rsquo;m working on ${esc(a.problem)}.</p>
      <p style="margin:0;font:400 15px/1.5 ${BODY};color:#ffffff">Just hit reply.</p>
    </td></tr></table>`) : '';
  const nextHtml = has(issue.next) ? section(`${label('Next')}${para(issue.next)}`) : '';
  const videoBtn = has(issue.videoUrl) ? `<p style="margin:0 0 10px">${button('Watch this week’s video', issue.videoUrl, RED)}</p>` : '';

  const footer = `Vo Creative Co. &middot; Using AI to remove your content bottlenecks &middot; <a href="mailto:nathan@vocreativeco.com" style="color:#8a8a8a">nathan@vocreativeco.com</a><br>You&rsquo;re getting this because you signed up at <a href="${SITE}/studio/" style="color:#8a8a8a">vocreativeco.com/studio</a>. <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#8a8a8a">Unsubscribe</a><br>${esc(mailingAddress || FILL('mailing address'))}`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title>
<link rel="stylesheet" href="${FONTS_CSS}"></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(summary)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:28px 16px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="padding:0 0 18px;border-bottom:3px solid ${RED}">
    <p style="margin:0 0 6px;font:700 12px/1.3 ${TITLE};letter-spacing:.16em;text-transform:uppercase;color:${RED}">VCC update</p>
    <p style="margin:0;font:700 34px/1.05 ${TITLE};letter-spacing:-.01em;text-transform:uppercase;color:#000000">${esc(val(issue.date, 'date'))}</p>
  </td></tr>
  ${section(`${label('Summary')}${para(summary)}`)}
  ${section(`${label('Metrics')}${metricsBox}`)}
  ${section(`${label('Progress')}<p style="margin:0 0 14px;font:700 22px/1.2 ${TITLE};text-transform:uppercase;color:#000000">${esc(val(p.title, 'what shipped or what a pilot proved'))}</p>${shotHtml}${cardHtml}`)}
  ${challengeHtml}
  ${askHtml}
  ${section(`${label('How I did it')}${howHtml}`)}
  ${nextHtml}
  ${section(`${videoBtn}<p style="margin:0">${button('Join the free Discord', DISCORD_URL)}</p>`)}
  ${section(`<p style="margin:0;font:400 17px/1.6 ${BODY};color:#111111">Nathan</p>`)}
  <tr><td style="padding:30px 0 0"><p style="margin:0;padding-top:14px;border-top:1px solid #eeeeee;font:400 12px/1.6 Helvetica, Arial, sans-serif;color:#8a8a8a">${footer}</p></td></tr>
</table>
</td></tr></table>
</body></html>`;

  const missing = (html.match(/\[FILL IN: [^\]]+\]/g) || []).map((x) => x.slice(10, -1));
  return { subject, preview: summary, html, ready: missing.length === 0, missing };
}

module.exports = { renderNewsletter, hasFillIn };
