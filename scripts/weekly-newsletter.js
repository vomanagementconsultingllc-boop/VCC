#!/usr/bin/env node
// Weekly VCC update newsletter: the deterministic half of the pipeline.
// The scheduled weekly-newsletter task (see scripts/WEEKLY_NEWSLETTER.md)
// writes the issue JSON from the week's video; this script does the rest.
//
//   node scripts/weekly-newsletter.js status            last issues, processed videos, last Discord count
//   node scripts/weekly-newsletter.js discord           current Discord member count
//   node scripts/weekly-newsletter.js preview issue.json   render to issue.html and report what's missing
//   node scripts/weekly-newsletter.js send issue.json      schedule the broadcast + ping Nathan (idempotent)
//
// Run with:  RESEND_API_KEY=proxy-injected NODE_USE_ENV_PROXY=1 \
//            NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/weekly-newsletter.js ...
// (in Claude cloud sessions the proxy fills in the real Resend key).
//
// State lives in Resend itself: every issue is a broadcast named
//   "VCC weekly | <date> | file=<drive file id> | discord=<count>"
// so a video is never sent twice and next week knows last week's count.

const fs = require('fs');
const path = require('path');
const { renderNewsletter } = require('../netlify/lib/newsletter.js');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'newsletter.config.json'), 'utf8'));
const API = process.env.RESEND_API_BASE || 'https://api.resend.com';
const KEY = process.env.RESEND_API_KEY || 'proxy-injected';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function resend(method, p, body) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(API + p, {
      method,
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (res.ok) return text ? JSON.parse(text) : {};
    if (res.status === 429 && attempt < 4) { await wait(1200); continue; }
    throw new Error(`Resend ${method} ${p} -> ${res.status} ${text.slice(0, 300)}`);
  }
}

async function listIssues() {
  const out = await resend('GET', '/broadcasts');
  return (out.data || [])
    .filter((b) => /^VCC weekly \|/.test(b.name || ''))
    .map((b) => {
      const file = (b.name.match(/file=([^\s|]+)/) || [])[1] || null;
      const discord = Number((b.name.match(/discord=(\d+)/) || [])[1]);
      return { id: b.id, name: b.name, status: b.status, created_at: b.created_at, scheduled_at: b.scheduled_at, sent_at: b.sent_at, file, discord: Number.isFinite(discord) ? discord : null };
    })
    .sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
}

async function discordCount() {
  const res = await fetch(`https://discord.com/api/v10/invites/${CONFIG.discordInvite}?with_counts=true`);
  const d = await res.json();
  if (!res.ok || typeof d.approximate_member_count !== 'number') throw new Error(`Discord invite lookup failed: ${res.status} ${JSON.stringify(d).slice(0, 200)}`);
  return { members: d.approximate_member_count, server: d.guild && d.guild.name, expires_at: d.expires_at };
}

// When the broadcast goes out: sendDelayMinutes from now, but never after
// latestSendTimeET on the same day (so it always lands the day of the upload),
// and never sooner than 10 minutes from now.
function sendTime(now = new Date()) {
  const later = new Date(now.getTime() + CONFIG.sendDelayMinutes * 60000);
  const [hh, mm] = CONFIG.latestSendTimeET.split(':').map(Number);
  const dayET = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  // ET offset for that date (handles daylight saving)
  const probe = new Date(`${dayET}T12:00:00Z`);
  const etNoon = new Date(probe.toLocaleString('en-US', { timeZone: CONFIG.timezone }));
  const offsetMin = Math.round((probe - etNoon) / 60000);
  const cap = new Date(Date.parse(`${dayET}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`) + offsetMin * 60000);
  let at = later < cap ? later : cap;
  const floor = new Date(now.getTime() + 10 * 60000);
  if (at < floor) at = floor;
  return at;
}

const fmtET = (d) => d.toLocaleString('en-US', { timeZone: CONFIG.timezone, weekday: 'short', hour: 'numeric', minute: '2-digit' });

function previewEmail(n, note) {
  const banner = `<div style="margin:0 0 0;padding:14px 16px;background:#fff4c2;border-bottom:2px solid #e0b400;font:15px/1.5 -apple-system, Helvetica, Arial, sans-serif;color:#111">${note}</div>`;
  return n.html.replace(/<body([^>]*)>/, `<body$1>${banner}`);
}

async function cmdStatus() {
  const issues = await listIssues();
  const last = issues.find((i) => i.discord != null);
  console.log(JSON.stringify({
    processedFiles: issues.map((i) => i.file).filter(Boolean),
    lastDiscordCount: last ? last.discord : CONFIG.discordBaseline.members,
    lastDiscordCountFrom: last ? last.name : `baseline ${CONFIG.discordBaseline.date}`,
    mailingAddressSet: Boolean(CONFIG.mailingAddress),
    issues,
  }, null, 2));
}

async function cmdPreview(file) {
  const issue = JSON.parse(fs.readFileSync(file, 'utf8'));
  const n = renderNewsletter(issue, { mailingAddress: CONFIG.mailingAddress });
  const out = file.replace(/\.json$/, '') + '.html';
  fs.writeFileSync(out, n.html);
  console.log(JSON.stringify({ subject: n.subject, ready: n.ready, missing: n.missing, html: out }, null, 2));
}

async function cmdSend(file) {
  const issue = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!issue.driveFileId) throw new Error('issue.driveFileId is required (the weekly video\'s Drive file id).');
  const issues = await listIssues();
  const dupe = issues.find((i) => i.file === issue.driveFileId);
  if (dupe) { console.log(JSON.stringify({ skipped: true, reason: 'already sent or scheduled for this video', broadcast: dupe }, null, 2)); return; }

  const n = renderNewsletter(issue, { mailingAddress: CONFIG.mailingAddress });
  const when = sendTime();
  if (!n.ready) {
    // Not sendable: ping Nathan with what's missing; nothing goes to the list.
    const note = `<b>Not sent yet.</b> This week's issue is missing: ${n.missing.map((m) => m.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join(', ')}. Reply in your Link in bio Claude chat with the missing pieces and it goes out.`;
    const r = await resend('POST', '/emails', { from: CONFIG.from, to: [CONFIG.previewTo], subject: `[Needs you] ${n.subject}`, html: previewEmail(n, note) });
    console.log(JSON.stringify({ scheduled: false, missing: n.missing, pinged: r.id }, null, 2));
    return;
  }

  const name = `VCC weekly | ${issue.date} | file=${issue.driveFileId} | discord=${issue.metrics && issue.metrics.current}`;
  const b = await resend('POST', '/broadcasts', {
    segment_id: CONFIG.segmentId, from: CONFIG.from, reply_to: CONFIG.replyTo,
    subject: n.subject, preview_text: n.preview, html: n.html, name,
  });
  await resend('POST', `/broadcasts/${b.id}/send`, { scheduled_at: when.toISOString() });

  const note = `<b>Preview.</b> This goes to your whole list at <b>${fmtET(when)} ET</b>. To stop it, open <a href="https://resend.com/broadcasts">resend.com/broadcasts</a> and delete "${name.split(' | file=')[0]}", or tell your Link in bio Claude chat "stop the newsletter".`;
  const r = await resend('POST', '/emails', { from: CONFIG.from, to: [CONFIG.previewTo], subject: `[Preview, sends ${fmtET(when)}] ${n.subject}`, html: previewEmail(n, note) });
  console.log(JSON.stringify({ scheduled: true, broadcast: b.id, name, sendsAt: when.toISOString(), sendsAtET: fmtET(when), pinged: r.id }, null, 2));
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'status') return cmdStatus();
  if (cmd === 'discord') return console.log(JSON.stringify(await discordCount(), null, 2));
  if (cmd === 'preview' && arg) return cmdPreview(arg);
  if (cmd === 'send' && arg) return cmdSend(arg);
  if (cmd === 'sendtime') return console.log(sendTime(arg ? new Date(arg) : new Date()).toISOString());
  console.error('usage: status | discord | preview issue.json | send issue.json | sendtime [iso]');
  process.exit(2);
})().catch((e) => { console.error(e.message); process.exit(1); });
