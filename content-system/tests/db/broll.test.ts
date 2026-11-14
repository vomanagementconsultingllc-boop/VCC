import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, expectDenied, type Db } from "./harness";
import { brollPath, cleanup, seed, type Fixture } from "./fixtures";

/** The b-roll drop box: per-client requests, submission boxes, review, reshoot loop. */
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

const statusOf = async (requestId: string) =>
  (await db.query<{ status: string }>("select status from public.broll_requests where id = $1", [requestId]))[0].status;
const ids = (rows: Array<{ id: string }>) => new Set(rows.map((r) => r.id));

describe("each client's drop box is their own", () => {
  it("shows a client their own b-roll list and nobody else's", async () => {
    const rows = await asUser(db, fx.userA, (s) => s.query<{ id: string }>("select id from public.broll_requests"));
    expect(ids(rows)).toEqual(new Set([fx.brollOpenA, fx.brollDoneA]));
    const files = await asUser(db, fx.userA, (s) =>
      s.query<{ name: string }>("select name from storage.objects where bucket_id = 'broll'"),
    );
    expect(files.map((f) => f.name)).toEqual([brollPath(fx.clientA, fx.brollDoneA, fx.brollClipA)]);
  });

  it("only accepts a file into the client's own box, and not once the item is accepted", async () => {
    await asUser(db, fx.userA, (s) =>
      s.query("insert into storage.objects (bucket_id, name) values ('broll', $1)", [
        brollPath(fx.clientA, fx.brollOpenA, randomUUID(), "-f1.jpg"),
      ]),
    );
    const refused = [
      brollPath(fx.clientB, fx.brollOpenB, randomUUID()), // another client's box
      brollPath(fx.clientA, fx.brollOpenB, randomUUID()), // own folder name, their request
      brollPath(fx.clientA, fx.brollDoneA, randomUUID()), // already accepted
      `${fx.clientA}/loose.mp4`,
    ];
    for (const name of refused) {
      await expectDenied(
        asUser(db, fx.userA, (s) => s.query("insert into storage.objects (bucket_id, name) values ('broll', $1)", [name])),
      );
    }
    await expectDenied(
      asUser(db, null, (s) =>
        s.query("insert into storage.objects (bucket_id, name) values ('broll', $1)", [
          brollPath(fx.clientA, fx.brollOpenA, randomUUID()),
        ]),
      ),
    );
  });

  it("lets the client change nothing about the list itself", async () => {
    await asUser(db, fx.userA, (s) => s.query("update public.broll_requests set status = 'accepted', title = 'hacked'"));
    await asUser(db, fx.userA, (s) => s.query("delete from public.broll_requests"));
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query("insert into public.broll_requests (client_id, title) values ($1, 'my own idea')", [fx.clientA]),
      ),
    );
    expect(await statusOf(fx.brollOpenA)).toBe("open");
  });
});

describe("submit, review, advise, resubmit", () => {
  const first = randomUUID();
  const second = randomUUID();

  it("records a submission as unreviewed, whatever the uploader claims", async () => {
    const path = brollPath(fx.clientA, fx.brollOpenA, first);
    await asUser(db, fx.userA, async (s) => {
      await s.query("insert into storage.objects (bucket_id, name) values ('broll', $1)", [path]);
      await s.query(
        `insert into public.broll_submissions (id, request_id, client_id, storage_path, check_status, feedback, reviewed_by)
         values ($1, $2, $3, $4, 'passed', 'looks great', 'team')`,
        [first, fx.brollOpenA, fx.clientA, path],
      );
    });
    const [row] = await db.query<{ check_status: string; feedback: string; reviewed_by: string; uploaded_by: string }>(
      "select check_status, feedback, reviewed_by, uploaded_by from public.broll_submissions where id = $1",
      [first],
    );
    expect(row).toEqual({ check_status: "pending", feedback: "", reviewed_by: "", uploaded_by: fx.userA });
    expect(await statusOf(fx.brollOpenA)).toBe("submitted");
  });

  it("refuses a submission with no file behind it, or for another client's request", async () => {
    let code: string | undefined;
    try {
      await asUser(db, fx.userA, (s) =>
        s.query("insert into public.broll_submissions (request_id, client_id, storage_path) values ($1, $2, $3)", [
          fx.brollOpenA,
          fx.clientA,
          brollPath(fx.clientA, fx.brollOpenA, randomUUID()),
        ]),
      );
    } catch (err) {
      code = (err as { code?: string }).code;
    }
    expect(code).toBe("23514");

    const theirs = brollPath(fx.clientB, fx.brollOpenB, randomUUID());
    await db.query("insert into storage.objects (bucket_id, name) values ('broll', $1)", [theirs]);
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query("insert into public.broll_submissions (request_id, client_id, storage_path) values ($1, $2, $3)", [
          fx.brollOpenB,
          fx.clientB,
          theirs,
        ]),
      ),
    );
  });

  it("reopens the box with advice when the review says the clip is not usable", async () => {
    // The review runs server-side; the client cannot write its result.
    await asUser(db, fx.userA, (s) => s.query("update public.broll_submissions set check_status = 'passed'"));
    await db.query(
      `update public.broll_submissions
          set check_status = 'failed', flags = '{too_dark}', reviewed_by = 'ai', checked_at = now(),
              feedback = 'It is too dark to see your hands. Stand facing the window and film it again.'
        where id = $1`,
      [first],
    );
    expect(await statusOf(fx.brollOpenA)).toBe("needs_reshoot");
    const [mine] = await asUser(db, fx.userA, (s) =>
      s.query<{ feedback: string; check_status: string }>(
        "select feedback, check_status from public.broll_submissions where id = $1",
        [first],
      ),
    );
    expect(mine.check_status).toBe("failed");
    expect(mine.feedback).toMatch(/facing the window/);
  });

  it("takes a new clip, replaces the old one, and closes the box once it is accepted", async () => {
    const path = brollPath(fx.clientA, fx.brollOpenA, second);
    await asUser(db, fx.userA, async (s) => {
      await s.query("insert into storage.objects (bucket_id, name) values ('broll', $1)", [path]);
      await s.query("insert into public.broll_submissions (id, request_id, client_id, storage_path) values ($1, $2, $3, $4)", [
        second,
        fx.brollOpenA,
        fx.clientA,
        path,
      ]);
    });
    const [old] = await db.query<{ superseded: boolean }>("select superseded from public.broll_submissions where id = $1", [first]);
    expect(old.superseded).toBe(true);
    expect(await statusOf(fx.brollOpenA)).toBe("submitted");

    await db.query("update public.broll_submissions set check_status = 'passed', reviewed_by = 'ai' where id = $1", [second]);
    expect(await statusOf(fx.brollOpenA)).toBe("accepted");
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query("insert into storage.objects (bucket_id, name) values ('broll', $1)", [
          brollPath(fx.clientA, fx.brollOpenA, randomUUID()),
        ]),
      ),
    );
  });

  it("lets the team overrule the review either way", async () => {
    await asUser(db, fx.team, (s) =>
      s.query(
        "update public.broll_submissions set check_status = 'failed', reviewed_by = 'team', feedback = 'Too shaky, rest the phone on a shelf.' where id = $1",
        [second],
      ),
    );
    expect(await statusOf(fx.brollOpenA)).toBe("needs_reshoot");
  });
});

describe("editors", () => {
  it("can use a client's accepted b-roll only while they have an open job for that client", async () => {
    const requests = await asUser(db, fx.editor, (s) => s.query<{ id: string }>("select id from public.broll_requests"));
    expect(ids(requests)).toEqual(new Set([fx.brollDoneA]));
    const clips = await asUser(db, fx.editor, (s) => s.query<{ id: string }>("select id from public.broll_submissions"));
    expect(ids(clips)).toEqual(new Set([fx.brollClipA]));
    const files = await asUser(db, fx.editor, (s) =>
      s.query<{ name: string }>("select name from storage.objects where bucket_id = 'broll'"),
    );
    expect(files.map((f) => f.name)).toEqual([brollPath(fx.clientA, fx.brollDoneA, fx.brollClipA)]);

    for (const table of ["broll_requests", "broll_submissions"]) {
      const none = await asUser(db, fx.idleEditor, (s) => s.query(`select * from public.${table}`));
      expect(none, table).toEqual([]);
    }
  });
});
