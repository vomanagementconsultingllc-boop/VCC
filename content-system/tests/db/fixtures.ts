import { randomUUID } from "node:crypto";
import type { Db } from "./harness";

/**
 * Two clients (A and B) with a full set of rows each, plus one user per role.
 * Seeded as the database owner, bypassing RLS, the way real data would exist
 * before anyone signs in. Every id is random so the suite can also run
 * against a shared local Supabase database and clean up after itself.
 */
export type Fixture = Awaited<ReturnType<typeof seed>>;

export async function seed(db: Db) {
  const ids = {
    admin: randomUUID(),
    team: randomUUID(),
    editor: randomUUID(),
    otherEditor: randomUUID(),
    idleEditor: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    clientA: randomUUID(),
    clientB: randomUUID(),
  };
  const tag = ids.clientA.slice(0, 8);
  const email = (name: string) => `${name}-${tag}@example.test`;

  const users: Array<[string, string]> = [
    [ids.admin, email("admin")],
    [ids.team, email("team")],
    [ids.editor, email("editor")],
    [ids.otherEditor, email("other-editor")],
    [ids.idleEditor, email("idle-editor")],
    [ids.userA, email("client-a")],
    [ids.userB, email("client-b")],
  ];
  for (const [id, mail] of users) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [id, mail]);
  }

  await db.query(
    `insert into public.clients (id, name, business, niche_tags, platforms, status) values
       ($1, 'Client A', 'A Bakery', '{bakery}', '{instagram}', 'active'),
       ($2, 'Client B', 'B Plumbing', '{plumbing}', '{tiktok}', 'active')`,
    [ids.clientA, ids.clientB],
  );

  await db.query(
    `insert into public.profiles (id, role, client_id, full_name, email) values
       ($1, 'admin',  null, 'Admin',        $7),
       ($2, 'team',   null, 'Team VA',      $8),
       ($3, 'editor', null, 'Editor One',   $9),
       ($4, 'editor', null, 'Editor Two',   $10),
       ($5, 'client', $11,  'A Owner',      $12),
       ($6, 'client', $13,  'B Owner',      $14),
       ($15, 'editor', null, 'Editor Idle', $16)`,
    [
      ids.admin, ids.team, ids.editor, ids.otherEditor, ids.userA, ids.userB,
      email("admin"), email("team"), email("editor"), email("other-editor"),
      ids.clientA, email("client-a"), ids.clientB, email("client-b"),
      ids.idleEditor, email("idle-editor"),
    ],
  );

  for (const [clientId, label] of [[ids.clientA, "A"], [ids.clientB, "B"]] as const) {
    await db.query(
      `insert into public.voice_profiles (client_id, interview_transcript, phrases_use, phrases_never, tone_notes, summary, offer)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        clientId,
        `SECRET transcript ${label}`,
        [`phrase ${label}`],
        [`never ${label}`],
        `internal tone notes ${label}`,
        `summary ${label}`,
        `offer ${label}`,
      ],
    );
    await db.query("insert into public.voice_corrections (client_id, body, created_by) values ($1, $2, null)", [
      clientId,
      `correction ${label}`,
    ]);
    await db.query("insert into public.client_notes (client_id, body, created_by) values ($1, $2, null)", [
      clientId,
      `internal note ${label}`,
    ]);
    await db.query("insert into public.client_financials (client_id, price_per_video_cents) values ($1, 15000)", [
      clientId,
    ]);
  }

  // --- Step 2: scripts. Each client gets a draft (not yet sent) and a sent script.
  const scripts = {
    draftA: randomUUID(),
    sentA: randomUUID(),
    draftB: randomUUID(),
    sentB: randomUUID(),
  };
  for (const [clientId, label, draftId, sentId] of [
    [ids.clientA, "A", scripts.draftA, scripts.sentA],
    [ids.clientB, "B", scripts.draftB, scripts.sentB],
  ] as const) {
    await db.query(
      `insert into public.scripts (id, client_id, title, hook, body, stage, created_by) values
         ($1, $3, $4, 'draft hook', 'draft body', 'scripted', null),
         ($2, $3, $5, 'sent hook', $6, 'scripted', null)`,
      [draftId, sentId, clientId, `Draft ${label}`, `Sent ${label}`, `sent body ${label}`],
    );
    for (const scriptId of [draftId, sentId]) {
      await db.query(
        `insert into public.shots (script_id, client_id, shot_number, instruction) values
           ($1, $2, 1, 'Talk to camera'), ($1, $2, 2, 'Show the product')`,
        [scriptId, clientId],
      );
      await db.query(
        "insert into public.script_comments (script_id, client_id, author_id, body) values ($1, $2, null, $3)",
        [scriptId, clientId, `team comment ${label}`],
      );
      await db.query("update public.script_internal set internal_notes = $2 where script_id = $1", [
        scriptId,
        `INTERNAL script note ${label}`,
      ]);
    }
    await db.query("update public.scripts set stage = 'sent_to_client' where id = $1", [sentId]);
  }

  // --- Step 3: a script that is waiting for footage, with one clip already in.
  const shoot = {
    shootA: randomUUID(),
    shootB: randomUUID(),
    shotA1: randomUUID(),
    shotA2: randomUUID(),
    shotB1: randomUUID(),
    shotB2: randomUUID(),
    uploadA: randomUUID(),
    uploadB: randomUUID(),
  };
  for (const [clientId, label, scriptId, shot1, shot2, uploadId] of [
    [ids.clientA, "A", shoot.shootA, shoot.shotA1, shoot.shotA2, shoot.uploadA],
    [ids.clientB, "B", shoot.shootB, shoot.shotB1, shoot.shotB2, shoot.uploadB],
  ] as const) {
    await db.query(
      "insert into public.scripts (id, client_id, title, body, stage, created_by) values ($1, $2, $3, 'shoot body', 'scripted', null)",
      [scriptId, clientId, `Shoot ${label}`],
    );
    await db.query(
      `insert into public.shots (id, script_id, client_id, shot_number, instruction, min_duration_seconds) values
         ($1, $3, $4, 1, 'Talk to camera', 5), ($2, $3, $4, 2, 'Show the product', 5)`,
      [shot1, shot2, scriptId, clientId],
    );
    await db.query("update public.scripts set stage = 'sent_to_client' where id = $1", [scriptId]);
    await db.query("update public.scripts set stage = 'awaiting_footage', client_approved = true where id = $1", [
      scriptId,
    ]);
    const path = footagePath(clientId, scriptId, shot1, uploadId);
    await db.query("insert into storage.objects (bucket_id, name) values ('footage', $1)", [path]);
    await db.query(
      `insert into public.footage_uploads
         (id, script_id, shot_id, client_id, storage_path, uploaded_by, duration_seconds, width, height, has_audio, check_status, checked_at)
       values ($1, $2, $3, $4, $5, null, 12, 1080, 1920, true, 'passed', now())`,
      [uploadId, scriptId, shot1, clientId, path],
    );
  }

  // --- Step 4: one script in edit (job assigned) and one already delivered, per client.
  // Client A's jobs belong to `editor`, client B's to `otherEditor`.
  const edit = {
    editA: randomUUID(),
    editB: randomUUID(),
    editShotA: randomUUID(),
    editShotB: randomUUID(),
    editClipA: randomUUID(),
    editClipB: randomUUID(),
    editJobA: randomUUID(),
    editJobB: randomUUID(),
    doneA: randomUUID(),
    doneB: randomUUID(),
    doneJobA: randomUUID(),
    doneJobB: randomUUID(),
    deliverableA: randomUUID(),
    deliverableB: randomUUID(),
  };
  for (const [clientId, label, editorId, e] of [
    [ids.clientA, "A", ids.editor, { script: edit.editA, shot: edit.editShotA, clip: edit.editClipA, job: edit.editJobA, done: edit.doneA, doneJob: edit.doneJobA, deliverable: edit.deliverableA }],
    [ids.clientB, "B", ids.otherEditor, { script: edit.editB, shot: edit.editShotB, clip: edit.editClipB, job: edit.editJobB, done: edit.doneB, doneJob: edit.doneJobB, deliverable: edit.deliverableB }],
  ] as const) {
    await db.query(
      `insert into public.scripts (id, client_id, title, body, stage, created_by) values
         ($1, $3, $4, 'edit body', 'in_edit', null), ($2, $3, $5, 'done body', 'delivered', null)`,
      [e.script, e.done, clientId, `In edit ${label}`, `Delivered ${label}`],
    );
    await db.query(
      "insert into public.shots (id, script_id, client_id, shot_number, instruction) values ($1, $2, $3, 1, 'Talk to camera')",
      [e.shot, e.script, clientId],
    );
    const clipPath = footagePath(clientId, e.script, e.shot, e.clip);
    await db.query("insert into storage.objects (bucket_id, name) values ('footage', $1)", [clipPath]);
    await db.query(
      `insert into public.footage_uploads (id, script_id, shot_id, client_id, storage_path, uploaded_by, check_status)
       values ($1, $2, $3, $4, $5, null, 'passed')`,
      [e.clip, e.script, e.shot, clientId, clipPath],
    );
    const finalPath = deliverablePath(clientId, e.doneJob, "final");
    await db.query("insert into storage.objects (bucket_id, name) values ('deliverables', $1)", [finalPath]);
    await db.query(
      `insert into public.edit_jobs (id, script_id, client_id, editor_id, status, client_label, style_notes, deliverable_path, created_by) values
         ($1, $3, $5, $6, 'queued', $7, 'fast cuts', null, null),
         ($2, $4, $5, $6, 'done', $7, '', $8, null)`,
      [e.job, e.doneJob, e.script, e.done, clientId, editorId, `Business ${label}`, finalPath],
    );
    await db.query(
      "insert into public.job_messages (job_id, client_id, author_id, kind, body) values ($1, $2, null, 'note', $3)",
      [e.job, clientId, `job note ${label}`],
    );
    await db.query(
      `insert into public.deliverables (id, edit_job_id, script_id, client_id, file_path, caption_draft, created_by)
       values ($1, $2, $3, $4, $5, $6, null)`,
      [e.deliverable, e.doneJob, e.done, clientId, finalPath, `caption ${label}`],
    );
  }

  return { ...ids, ...scripts, ...shoot, ...edit, tag };
}

export function footagePath(clientId: string, scriptId: string, shotId: string, uploadId: string) {
  return `${clientId}/${scriptId}/${shotId}/${uploadId}.mp4`;
}

export function deliverablePath(clientId: string, jobId: string, name: string) {
  return `${clientId}/${jobId}/${name}.mp4`;
}

/** Remove everything a seed() created. Only matters on a shared database. */
export async function cleanup(db: Db, fx: Fixture) {
  const clientIds = [fx.clientA, fx.clientB];
  const userIds = [fx.admin, fx.team, fx.editor, fx.otherEditor, fx.idleEditor, fx.userA, fx.userB];
  for (const clientId of clientIds) {
    await db.query("delete from storage.objects where name like $1", [`${clientId}/%`]);
  }
  await db.query("delete from public.clients where id = any($1::uuid[])", [clientIds]);
  await db.query("delete from auth.users where id = any($1::uuid[])", [userIds]);
  await db.query("delete from public.audit_log where client_id = any($1::uuid[]) or actor_id = any($2::uuid[])", [
    clientIds,
    userIds,
  ]);
}
