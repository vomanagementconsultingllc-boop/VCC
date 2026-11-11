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
       ($6, 'client', $13,  'B Owner',      $14)`,
    [
      ids.admin, ids.team, ids.editor, ids.otherEditor, ids.userA, ids.userB,
      email("admin"), email("team"), email("editor"), email("other-editor"),
      ids.clientA, email("client-a"), ids.clientB, email("client-b"),
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

  return { ...ids, tag };
}

/** Remove everything a seed() created. Only matters on a shared database. */
export async function cleanup(db: Db, fx: Fixture) {
  const clientIds = [fx.clientA, fx.clientB];
  const userIds = [fx.admin, fx.team, fx.editor, fx.otherEditor, fx.userA, fx.userB];
  await db.query("delete from public.clients where id = any($1::uuid[])", [clientIds]);
  await db.query("delete from auth.users where id = any($1::uuid[])", [userIds]);
  await db.query("delete from public.audit_log where client_id = any($1::uuid[]) or actor_id = any($2::uuid[])", [
    clientIds,
    userIds,
  ]);
}
