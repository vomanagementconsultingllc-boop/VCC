import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, expectDenied, type Db } from "./harness";
import { cleanup, seed, type Fixture } from "./fixtures";

/** Build step 5: research items, hooks, ranking, AI call log. */
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

describe("research is internal", () => {
  it("is invisible to clients and editors, including through the ranking view", async () => {
    for (const user of [fx.userA, fx.editor, fx.idleEditor]) {
      for (const table of ["research_items", "hooks", "hook_uses", "ai_calls", "hook_rankings"]) {
        const rows = await asUser(db, user, (s) => s.query(`select * from public.${table}`));
        expect(rows, `${table}`).toEqual([]);
      }
    }
  });

  it("is refused to signed-out visitors", async () => {
    for (const table of ["research_items", "hooks", "hook_rankings"]) {
      await expectDenied(asUser(db, null, (s) => s.query(`select * from public.${table} limit 1`)));
    }
  });

  it("is shared by the whole team", async () => {
    const rows = await asUser(db, fx.team, (s) =>
      s.query<{ id: string }>("select id from public.research_items where id = any($1::uuid[])", [
        [fx.outlier, fx.staleOutlier],
      ]),
    );
    expect(rows).toHaveLength(2);
  });
});

describe("what counts as proven", () => {
  it("is views divided by the creator's own median, not raw views", async () => {
    const rows = await db.query<{ id: string; performance_ratio: string | null }>(
      "select id, performance_ratio from public.research_items where id = any($1::uuid[])",
      [[fx.outlier, fx.staleOutlier]],
    );
    const ratio = (id: string) => Number(rows.find((r) => r.id === id)!.performance_ratio);
    expect(ratio(fx.outlier)).toBe(5); // 300k views on a 60k median
    expect(ratio(fx.staleOutlier)).toBe(8); // 800k views on a 100k median
  });

  it("has no ratio when the creator's median is unknown", async () => {
    const [{ performance_ratio }] = await asUser(db, fx.team, (s) =>
      s.query<{ performance_ratio: string | null }>(
        `insert into public.research_items (source_url, platform, view_count)
         values ($1, 'instagram', 5000000) returning performance_ratio`,
        [`https://example.test/v/${fx.tag}-nomedian`],
      ),
    );
    expect(performance_ratio).toBeNull();
    await db.query("delete from public.research_items where source_url = $1", [
      `https://example.test/v/${fx.tag}-nomedian`,
    ]);
  });

  it("keeps full weight for 60 days, then halves every 30", async () => {
    const score = async (ratio: number | null, days: number) =>
      Number(
        (
          await db.query<{ s: string }>(
            "select public.hook_score($1::numeric, timestamptz '2027-01-01' - make_interval(days => $2), timestamptz '2027-01-01') as s",
            [ratio, days],
          )
        )[0].s,
      );
    expect(await score(6, 0)).toBe(6);
    expect(await score(6, 60)).toBe(6);
    expect(await score(6, 90)).toBe(3);
    expect(await score(6, 120)).toBe(1.5);
    expect(await score(null, 5)).toBe(0);
  });

  it("ranks a fresh 5x hook above a four-month-old 8x hook", async () => {
    const rows = await asUser(db, fx.team, (s) =>
      s.query<{ id: string; score: string; times_used: string }>(
        "select id, score, times_used from public.hook_rankings where id = any($1::uuid[]) order by score desc",
        [[fx.hook, fx.spareHook]],
      ),
    );
    expect(rows.map((r) => r.id)).toEqual([fx.hook, fx.spareHook]);
    expect(Number(rows[0].score)).toBe(5);
    expect(Number(rows[1].score)).toBeLessThan(5);
    // Usage history: the fresh hook went out for both clients.
    expect(Number(rows[0].times_used)).toBe(2);
    expect(Number(rows[1].times_used)).toBe(0);
  });
});

describe("hook usage history", () => {
  it("records a use when the script built on a hook is sent to the client", async () => {
    await asUser(db, fx.team, async (s) => {
      await s.query("update public.script_internal set hook_id = $2, source_research_item_id = $3 where script_id = $1", [
        fx.draftA,
        fx.spareHook,
        fx.staleOutlier,
      ]);
      await s.query("update public.scripts set stage = 'sent_to_client' where id = $1", [fx.draftA]);
    });
    const uses = await db.query<{ client_id: string }>(
      "select client_id from public.hook_uses where hook_id = $1 and script_id = $2",
      [fx.spareHook, fx.draftA],
    );
    expect(uses).toEqual([{ client_id: fx.clientA }]);
    // Pulling back and re-sending does not count twice.
    await asUser(db, fx.team, async (s) => {
      await s.query("update public.scripts set stage = 'scripted' where id = $1", [fx.draftA]);
      await s.query("update public.scripts set stage = 'sent_to_client' where id = $1", [fx.draftA]);
    });
    const [{ n }] = await db.query<{ n: number }>(
      "select count(*)::int as n from public.hook_uses where hook_id = $1 and script_id = $2",
      [fx.spareHook, fx.draftA],
    );
    expect(n).toBe(1);
  });
});

describe("the AI call log", () => {
  it("can be written by staff under their own name, and never edited or deleted", async () => {
    await asUser(db, fx.team, (s) =>
      s.query(
        "insert into public.ai_calls (client_id, purpose, model, input_hash, input_chars) values ($1, 'draft_script', 'claude-opus-5-5', 'feedface', 1200)",
        [fx.clientA],
      ),
    );
    await expectDenied(
      asUser(db, fx.team, (s) =>
        s.query(
          "insert into public.ai_calls (client_id, purpose, model, input_hash, created_by) values ($1, 'x', 'm', 'h', $2)",
          [fx.clientA, fx.admin],
        ),
      ),
    );
    await expectDenied(asUser(db, fx.admin, (s) => s.query("update public.ai_calls set purpose = 'edited'")));
    await expectDenied(asUser(db, fx.admin, (s) => s.query("delete from public.ai_calls")));
    const logged = await asUser(db, fx.admin, (s) =>
      s.query<{ created_by: string }>(
        "select created_by from public.ai_calls where client_id = $1 and input_hash = 'feedface'",
        [fx.clientA],
      ),
    );
    expect(logged).toEqual([{ created_by: fx.team }]);
  });
});
