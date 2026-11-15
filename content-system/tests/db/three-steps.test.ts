import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, expectDenied, type Db } from "./harness";
import { cleanup, seed, type Fixture } from "./fixtures";

/** Plan, Shoot, Finish: intake questionnaire, client fixes and approval. */
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

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

describe("the intake questionnaire", () => {
  it("is private to the client and the team", async () => {
    const mine = await asUser(db, fx.userA, (s) => s.query<{ client_id: string }>("select client_id from public.client_intake"));
    expect(mine.map((r) => r.client_id)).toEqual([fx.clientA]);
    for (const user of [fx.editor, fx.idleEditor]) {
      expect(await asUser(db, user, (s) => s.query("select * from public.client_intake"))).toEqual([]);
    }
    const team = await asUser(db, fx.team, (s) =>
      s.query("select 1 from public.client_intake where client_id = any($1::uuid[])", [[fx.clientA, fx.clientB]]),
    );
    expect(team).toHaveLength(2);
  });

  it("saves only through the client's own submission, and tells the team", async () => {
    // No direct writes, and no writing into another client's row.
    await asUser(db, fx.userA, (s) => s.query("update public.client_intake set answers = '{\"x\":1}'"));
    const [other] = await db.query<{ answers: { locations: string } }>(
      "select answers from public.client_intake where client_id = $1",
      [fx.clientB],
    );
    expect(other.answers.locations).toBe("PRIVATE shop floor B");

    await asUser(db, fx.userA, (s) =>
      s.query("select public.submit_intake($1::jsonb)", [
        JSON.stringify({ niche_keywords: ["Sourdough ", "artisan bakery"], locations: "Front counter by the window" }),
      ]),
    );
    const [row] = await db.query<{ answers: { locations: string }; completed_at: string | null }>(
      "select answers, completed_at from public.client_intake where client_id = $1",
      [fx.clientA],
    );
    expect(row.answers.locations).toBe("Front counter by the window");
    expect(row.completed_at).not.toBeNull();
    const kinds = await db.query<{ kind: string }>(
      "select kind from public.notifications where client_id = $1 and kind = 'intake_completed'",
      [fx.clientA],
    );
    expect(kinds.length).toBeGreaterThan(0);

    for (const user of [fx.editor, fx.team]) {
      await expectDenied(asUser(db, user, (s) => s.query("select public.submit_intake('{}'::jsonb)")));
    }
    expect(await errorCode(asUser(db, fx.userA, (s) => s.query("select public.submit_intake('[1,2]'::jsonb)")))).toBe("23514");
  });

  it("seeds research keywords only when the team has not set any", async () => {
    // Client A already has niche tags from the team: the questionnaire does not overwrite them.
    const [a] = await db.query<{ niche_tags: string[] }>("select niche_tags from public.clients where id = $1", [fx.clientA]);
    expect(a.niche_tags).toEqual(["bakery"]);

    await db.query("update public.clients set niche_tags = '{}' where id = $1", [fx.clientB]);
    await asUser(db, fx.userB, (s) =>
      s.query("select public.submit_intake($1::jsonb)", [JSON.stringify({ niche_keywords: ["Emergency Plumber", "  ", "drain cleaning"] })]),
    );
    const [b] = await db.query<{ niche_tags: string[] }>("select niche_tags from public.clients where id = $1", [fx.clientB]);
    expect([...b.niche_tags].sort()).toEqual(["drain cleaning", "emergency plumber"]);
  });
});

describe("the inspiration link", () => {
  it("is the one research detail a client sees, on their own sent scripts", async () => {
    await db.query("update public.scripts set inspo_url = 'https://example.test/inspo', week_of = '2027-01-04' where id = $1", [fx.sentA]);
    const rows = await asUser(db, fx.userA, (s) =>
      s.query<{ inspo_url: string }>("select inspo_url from public.scripts where id = $1", [fx.sentA]),
    );
    expect(rows).toEqual([{ inspo_url: "https://example.test/inspo" }]);
    expect(await asUser(db, fx.userA, (s) => s.query("select * from public.research_items"))).toEqual([]);
    expect(await asUser(db, fx.userB, (s) => s.query("select inspo_url from public.scripts where id = $1", [fx.sentA]))).toEqual([]);
  });
});

describe("finishing a video", () => {
  it("lets a client approve their own edit, and nobody else's", async () => {
    await asUser(db, fx.userB, (s) => s.query("select public.client_approve_video($1)", [fx.deliverableB]));
    const [row] = await db.query<{ client_approved_at: string | null }>(
      "select client_approved_at from public.deliverables where id = $1",
      [fx.deliverableB],
    );
    expect(row.client_approved_at).not.toBeNull();
    await expectDenied(asUser(db, fx.userA, (s) => s.query("select public.client_approve_video($1)", [fx.deliverableB])));
  });

  it("takes the video back for a fix: hidden again, job reopened with the note, counted as a revision", async () => {
    await expectDenied(asUser(db, fx.userB, (s) => s.query("select public.client_request_fix($1, 'x')", [fx.deliverableA])));
    expect(await errorCode(asUser(db, fx.userA, (s) => s.query("select public.client_request_fix($1, '  ')", [fx.deliverableA])))).toBe("23514");

    await asUser(db, fx.userA, (s) =>
      s.query("select public.client_request_fix($1, 'The caption covers my face at the start')", [fx.deliverableA]),
    );
    expect(await db.query("select 1 from public.deliverables where id = $1", [fx.deliverableA])).toEqual([]);
    const [job] = await db.query<{ status: string; revision_count: number }>(
      "select status, revision_count from public.edit_jobs where id = $1",
      [fx.doneJobA],
    );
    expect(job).toEqual({ status: "revision", revision_count: 1 });
    const [script] = await db.query<{ stage: string }>("select stage from public.scripts where id = $1", [fx.doneA]);
    expect(script.stage).toBe("in_edit");

    // The editor gets the note on the job thread; the client can no longer see the file.
    const thread = await asUser(db, fx.editor, (s) =>
      s.query<{ body: string }>("select body from public.job_messages where job_id = $1 and kind = 'revision_request'", [fx.doneJobA]),
    );
    expect(thread).toEqual([{ body: "From the client: The caption covers my face at the start" }]);
    const files = await asUser(db, fx.userA, (s) =>
      s.query("select name from storage.objects where bucket_id = 'deliverables'"),
    );
    expect(files).toEqual([]);
  });
});
