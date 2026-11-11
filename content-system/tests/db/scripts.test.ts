import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, expectDenied, type Db } from "./harness";
import { cleanup, seed, type Fixture } from "./fixtures";

/** Build step 2: scripts, shots, briefs and comments. */
let db: Db;
let fx: Fixture;

beforeAll(async () => {
  db = await createTestDb();
  fx = await seed(db);
}, 120_000);

afterAll(async () => {
  if (db) {
    if (db.mode === "postgres") await cleanup(db, fx);
    await db.close();
  }
});

async function expectError(promise: Promise<unknown>, code: string, message?: RegExp) {
  let error: { code?: string; message?: string } | undefined;
  try {
    await promise;
  } catch (err) {
    error = err as { code?: string; message?: string };
  }
  expect(error, "expected the statement to fail").toBeDefined();
  expect(error!.code).toBe(code);
  if (message) expect(error!.message).toMatch(message);
}

describe("what a client sees", () => {
  it("is their sent script, not their drafts, and nothing of another client", async () => {
    const rows = await asUser(db, fx.userA, (s) => s.query<{ id: string }>("select id from public.scripts"));
    expect(rows.map((r) => r.id)).toEqual([fx.sentA]);
  });

  it("includes the shots, brief and comments of the sent script only", async () => {
    for (const table of ["shots", "shooting_briefs", "script_comments"]) {
      const rows = await asUser(db, fx.userA, (s) =>
        s.query<{ script_id: string }>(`select script_id from public.${table}`),
      );
      expect(rows.length, table).toBeGreaterThan(0);
      expect(new Set(rows.map((r) => r.script_id)), table).toEqual(new Set([fx.sentA]));
    }
  });

  it("never includes internal script notes", async () => {
    const rows = await asUser(db, fx.userA, (s) => s.query("select * from public.script_internal"));
    expect(rows).toEqual([]);
  });
});

describe("what a client can change", () => {
  it("is nothing directly: scripts, shots and briefs are read-only", async () => {
    await asUser(db, fx.userA, (s) => s.query("update public.scripts set body = 'hacked', stage = 'delivered'"));
    await asUser(db, fx.userA, (s) => s.query("update public.shots set instruction = 'hacked'"));
    await asUser(db, fx.userA, (s) => s.query("delete from public.shots"));
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query("insert into public.scripts (client_id, title) values ($1, 'mine')", [fx.clientA]),
      ),
    );
    const [script] = await db.query<{ body: string; stage: string }>(
      "select body, stage from public.scripts where id = $1",
      [fx.sentA],
    );
    expect(script).toEqual({ body: "sent body A", stage: "sent_to_client" });
    const [{ n }] = await db.query<{ n: number }>(
      "select count(*)::int as n from public.shots where script_id = $1 and instruction <> 'hacked'",
      [fx.sentA],
    );
    expect(n).toBe(2);
  });

  it("can comment on their sent script, but not on a draft or another client's script", async () => {
    await asUser(db, fx.userA, (s) =>
      s.query("insert into public.script_comments (script_id, client_id, body) values ($1, $2, 'Love it')", [
        fx.sentA,
        fx.clientA,
      ]),
    );
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query("insert into public.script_comments (script_id, client_id, body) values ($1, $2, 'x')", [
          fx.draftA,
          fx.clientA,
        ]),
      ),
    );
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query("insert into public.script_comments (script_id, client_id, body) values ($1, $2, 'x')", [
          fx.sentB,
          fx.clientB,
        ]),
      ),
    );
    // Cannot post a comment pretending to be someone else.
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query(
          "insert into public.script_comments (script_id, client_id, author_id, body) values ($1, $2, $3, 'x')",
          [fx.sentA, fx.clientA, fx.admin],
        ),
      ),
    );
  });

  it("cannot approve or request changes on another client's script", async () => {
    await expectDenied(
      asUser(db, fx.userA, (s) => s.query("select public.client_approve_script($1)", [fx.sentB])),
    );
    await expectDenied(
      asUser(db, fx.userA, (s) => s.query("select public.client_request_changes($1, 'no')", [fx.sentB])),
    );
    const [b] = await db.query<{ stage: string }>("select stage from public.scripts where id = $1", [fx.sentB]);
    expect(b.stage).toBe("sent_to_client");
  });

  it("cannot approve a draft that was never sent", async () => {
    await expectError(
      asUser(db, fx.userA, (s) => s.query("select public.client_approve_script($1)", [fx.draftA])),
      "23514",
    );
  });

  it("approves with one call, which opens the footage stage", async () => {
    await asUser(db, fx.userA, (s) => s.query("select public.client_approve_script($1)", [fx.sentA]));
    const [script] = await db.query<{
      stage: string;
      client_approved: boolean;
      client_approved_at: string | null;
      footage_requested_at: string | null;
    }>("select stage, client_approved, client_approved_at, footage_requested_at from public.scripts where id = $1", [
      fx.sentA,
    ]);
    expect(script.stage).toBe("awaiting_footage");
    expect(script.client_approved).toBe(true);
    expect(script.client_approved_at).not.toBeNull();
    expect(script.footage_requested_at).not.toBeNull();
    // Approving twice is refused.
    await expectError(
      asUser(db, fx.userA, (s) => s.query("select public.client_approve_script($1)", [fx.sentA])),
      "23514",
    );
  });

  it("sends a script back with a comment, which hides it again until the team re-sends", async () => {
    await asUser(db, fx.userB, (s) =>
      s.query("select public.client_request_changes($1, 'I would not say it like that')", [fx.sentB]),
    );
    const [script] = await db.query<{ stage: string }>("select stage from public.scripts where id = $1", [fx.sentB]);
    expect(script.stage).toBe("scripted");
    const comments = await db.query<{ kind: string; author_id: string }>(
      "select kind, author_id from public.script_comments where script_id = $1 and kind = 'change_request'",
      [fx.sentB],
    );
    expect(comments).toEqual([{ kind: "change_request", author_id: fx.userB }]);
    const visible = await asUser(db, fx.userB, (s) => s.query("select id from public.scripts"));
    expect(visible).toEqual([]);
  });
});

describe("team rules enforced by the database", () => {
  it("refuses to send a script with no shots or no body", async () => {
    const [{ id }] = await asUser(db, fx.team, (s) =>
      s.query<{ id: string }>(
        "insert into public.scripts (client_id, title, body) values ($1, 'No shots yet', 'words') returning id",
        [fx.clientA],
      ),
    );
    await expectError(
      asUser(db, fx.team, (s) => s.query("update public.scripts set stage = 'sent_to_client' where id = $1", [id])),
      "23514",
      /at least one shot/,
    );
  });

  it("never ships an unreviewed AI draft", async () => {
    const [{ id }] = await asUser(db, fx.team, (s) =>
      s.query<{ id: string }>(
        "insert into public.scripts (client_id, title, body) values ($1, 'AI draft', 'machine words') returning id",
        [fx.clientA],
      ),
    );
    await asUser(db, fx.team, async (s) => {
      await s.query("insert into public.shots (script_id, client_id, shot_number) values ($1, $2, 1)", [
        id,
        fx.clientA,
      ]);
      await s.query("update public.script_internal set ai_drafted = true where script_id = $1", [id]);
    });
    await expectError(
      asUser(db, fx.team, (s) => s.query("update public.scripts set stage = 'sent_to_client' where id = $1", [id])),
      "23514",
      /not been reviewed/,
    );
    await asUser(db, fx.team, async (s) => {
      await s.query("update public.script_internal set reviewed_by = $2, reviewed_at = now() where script_id = $1", [
        id,
        fx.team,
      ]);
      await s.query("update public.scripts set stage = 'sent_to_client' where id = $1", [id]);
    });
    const [script] = await db.query<{ stage: string; sent_at: string | null }>(
      "select stage, sent_at from public.scripts where id = $1",
      [id],
    );
    expect(script.stage).toBe("sent_to_client");
    expect(script.sent_at).not.toBeNull();
  });

  it("bumps the version when the words change", async () => {
    const [before] = await db.query<{ version: number }>("select version from public.scripts where id = $1", [
      fx.draftA,
    ]);
    await asUser(db, fx.team, (s) =>
      s.query("update public.scripts set body = 'second pass' where id = $1", [fx.draftA]),
    );
    const [after] = await db.query<{ version: number }>("select version from public.scripts where id = $1", [
      fx.draftA,
    ]);
    expect(after.version).toBe(before.version + 1);
  });

  it("cannot attach a shot to a script under the wrong client", async () => {
    await expectError(
      db.query("insert into public.shots (script_id, client_id, shot_number) values ($1, $2, 9)", [
        fx.draftA,
        fx.clientB,
      ]),
      "23503",
    );
  });
});

describe("editors", () => {
  it("see no scripts until a job is assigned to them", async () => {
    for (const table of ["scripts", "shots", "shooting_briefs", "script_comments", "script_internal"]) {
      const rows = await asUser(db, fx.editor, (s) => s.query(`select * from public.${table}`));
      expect(rows, table).toEqual([]);
    }
  });
});
