import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, expectDenied, type Db } from "./harness";
import { brollPath, cleanup, seed, type Fixture } from "./fixtures";

/** Build steps 6 and 7: marking a video as posted, and who gets told about what. */
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

const kindsFor = async (recipient: string) =>
  (await db.query<{ kind: string }>("select kind from public.notifications where recipient_id = $1", [recipient])).map((r) => r.kind);

describe("marking a video as posted", () => {
  it("works for the client's own delivered video and moves it to posted", async () => {
    await asUser(db, fx.userA, (s) =>
      s.query("select public.client_mark_posted($1, 'tiktok', 'https://example.test/post/1')", [fx.deliverableA]),
    );
    const [script] = await db.query<{ stage: string; posted_at: string | null }>(
      "select stage, posted_at from public.scripts where id = $1",
      [fx.doneA],
    );
    expect(script.stage).toBe("posted");
    expect(script.posted_at).not.toBeNull();
    const logs = await asUser(db, fx.userA, (s) =>
      s.query<{ platform: string }>("select platform from public.performance_logs order by platform"),
    );
    expect(logs.map((l) => l.platform)).toEqual(["instagram", "tiktok"]);
  });

  it("is refused for another client's video, an unknown platform, or direct edits to the numbers", async () => {
    await expectDenied(asUser(db, fx.userA, (s) => s.query("select public.client_mark_posted($1, 'tiktok')", [fx.deliverableB])));
    let code: string | undefined;
    try {
      await asUser(db, fx.userA, (s) => s.query("select public.client_mark_posted($1, 'myspace')", [fx.deliverableA]));
    } catch (err) {
      code = (err as { code?: string }).code;
    }
    expect(code).toBe("23514");
    await asUser(db, fx.userA, (s) => s.query("update public.performance_logs set views_7d = 999999"));
    const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from public.performance_logs where views_7d is not null");
    expect(n).toBe(0);
  });
});

describe("notifications", () => {
  it("tells the right people when things happen", async () => {
    // From the seed: scripts were sent to both clients, jobs assigned, videos delivered, b-roll lists created.
    expect(await kindsFor(fx.userA)).toEqual(expect.arrayContaining(["script_ready", "delivered", "broll_added"]));
    expect(await kindsFor(fx.editor)).toContain("job_assigned");

    // A client comment reaches the team (nobody is assigned to this client, so the admin).
    await asUser(db, fx.userA, (s) =>
      s.query("insert into public.script_comments (script_id, client_id, body) values ($1, $2, 'Can I film this outside?')", [
        fx.sentA,
        fx.clientA,
      ]),
    );
    expect(await kindsFor(fx.admin)).toContain("client_comment");
    expect(await kindsFor(fx.team)).not.toContain("client_comment");

    // With a team member assigned, they get it instead of the admin.
    await db.query("update public.clients set assigned_team_member = $2 where id = $1", [fx.clientB, fx.team]);
    await asUser(db, fx.userB, (s) =>
      s.query("select public.client_request_changes($1, 'Too salesy for me')", [fx.sentB]),
    );
    expect(await kindsFor(fx.team)).toContain("client_comment");
  });

  it("emails the client the advice when a b-roll clip needs another take", async () => {
    const id = randomUUID();
    const path = brollPath(fx.clientA, fx.brollOpenA, id);
    await asUser(db, fx.userA, async (s) => {
      await s.query("insert into storage.objects (bucket_id, name) values ('broll', $1)", [path]);
      await s.query("insert into public.broll_submissions (id, request_id, client_id, storage_path) values ($1, $2, $3, $4)", [
        id,
        fx.brollOpenA,
        fx.clientA,
        path,
      ]);
    });
    expect(await kindsFor(fx.admin)).toContain("broll_submitted");
    await db.query(
      "update public.broll_submissions set check_status = 'failed', reviewed_by = 'ai', feedback = 'Too dark. Face the window.' where id = $1",
      [id],
    );
    const [note] = await db.query<{ body: string; link: string; client_id: string }>(
      "select body, link, client_id from public.notifications where recipient_id = $1 and kind = 'broll_reshoot'",
      [fx.userA],
    );
    expect(note).toEqual({ body: "Too dark. Face the window.", link: "/portal/broll", client_id: fx.clientA });
  });

  it("can only be read by the person they are for, and written by nobody through the API", async () => {
    for (const user of [fx.userA, fx.userB, fx.editor, fx.team, fx.admin]) {
      const rows = await asUser(db, user, (s) => s.query<{ recipient_id: string }>("select recipient_id from public.notifications"));
      for (const row of rows) expect(row.recipient_id).toBe(user);
    }
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query("insert into public.notifications (recipient_id, kind, subject) values ($1, 'x', 'phish')", [fx.userB]),
      ),
    );
    await expectDenied(asUser(db, fx.admin, (s) => s.query("update public.notifications set subject = 'edited'")));
    await expectDenied(
      asUser(db, fx.userA, (s) => s.query("select private.notify($1, null, 'x', 'phish', '', '')", [fx.userB])),
    );
  });
});
