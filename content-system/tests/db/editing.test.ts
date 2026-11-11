import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, expectDenied, type Db } from "./harness";
import { cleanup, deliverablePath, footagePath, seed, type Fixture } from "./fixtures";

/** Build step 4: edit jobs, the editor role, revisions and delivery. */
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
const one = async <T>(sql: string, params: unknown[]) => (await db.query<T>(sql, params))[0];
const ids = (rows: Array<{ id: string }>) => new Set(rows.map((r) => r.id));

describe("an editor sees only the jobs assigned to them", () => {
  it("lists their own jobs and nobody else's", async () => {
    const mine = await asUser(db, fx.editor, (s) => s.query<{ id: string }>("select id from public.edit_jobs"));
    expect(ids(mine)).toEqual(new Set([fx.editJobA, fx.doneJobA]));
    const theirs = await asUser(db, fx.otherEditor, (s) => s.query<{ id: string }>("select id from public.edit_jobs"));
    expect(ids(theirs)).toEqual(new Set([fx.editJobB, fx.doneJobB]));
  });

  it("can read the script, shots and clips of an open job, and nothing else", async () => {
    const scripts = await asUser(db, fx.editor, (s) => s.query<{ id: string }>("select id from public.scripts"));
    expect(ids(scripts)).toEqual(new Set([fx.editA]));
    const shots = await asUser(db, fx.editor, (s) => s.query<{ id: string }>("select id from public.shots"));
    expect(ids(shots)).toEqual(new Set([fx.editShotA]));
    const clips = await asUser(db, fx.editor, (s) => s.query<{ id: string }>("select id from public.footage_uploads"));
    expect(ids(clips)).toEqual(new Set([fx.editClipA]));
  });

  it("cannot see clients, voice profiles, internal notes, comments, deliverables, costs or access keys", async () => {
    for (const table of [
      "clients",
      "voice_profiles",
      "voice_corrections",
      "client_notes",
      "client_financials",
      "script_internal",
      "script_comments",
      "shooting_briefs",
      "deliverables",
      "edit_job_costs",
      "editor_access_keys",
      "audit_log",
      "app_settings",
    ]) {
      const rows = await asUser(db, fx.editor, (s) => s.query(`select * from public.${table}`));
      expect(rows, table).toEqual([]);
    }
  });

  it("can download raw clips for an open job only", async () => {
    const rows = await asUser(db, fx.editor, (s) =>
      s.query<{ name: string }>("select name from storage.objects where bucket_id = 'footage'"),
    );
    expect(rows.map((r) => r.name)).toEqual([footagePath(fx.clientA, fx.editA, fx.editShotA, fx.editClipA)]);
  });

  it("can upload a cut only into their own open job", async () => {
    await asUser(db, fx.editor, (s) =>
      s.query("insert into storage.objects (bucket_id, name) values ('deliverables', $1)", [
        deliverablePath(fx.clientA, fx.editJobA, "probe"),
      ]),
    );
    const refused = [
      deliverablePath(fx.clientB, fx.editJobB, "x"), // another editor's job
      deliverablePath(fx.clientA, fx.doneJobA, "x"), // their own job, but finished
      deliverablePath(fx.clientB, fx.editJobA, "x"), // right job, wrong client folder
      `${fx.clientA}/loose.mp4`,
    ];
    for (const name of refused) {
      await expectDenied(
        asUser(db, fx.editor, (s) =>
          s.query("insert into storage.objects (bucket_id, name) values ('deliverables', $1)", [name]),
        ),
      );
    }
    // And never into the raw footage bucket.
    await expectDenied(
      asUser(db, fx.editor, (s) =>
        s.query("insert into storage.objects (bucket_id, name) values ('footage', $1)", [
          footagePath(fx.clientA, fx.editA, fx.editShotA, randomUUID()),
        ]),
      ),
    );
  });

  it("cannot change a job directly, or act on someone else's job", async () => {
    await asUser(db, fx.editor, (s) => s.query("update public.edit_jobs set status = 'done', revision_count = 0"));
    const job = await one<{ status: string }>("select status from public.edit_jobs where id = $1", [fx.editJobA]);
    expect(job.status).toBe("queued");

    await expectDenied(asUser(db, fx.otherEditor, (s) => s.query("select public.editor_start_job($1)", [fx.editJobA])));
    await expectDenied(
      asUser(db, fx.otherEditor, (s) =>
        s.query("select public.editor_submit_cut($1, $2, null, 'mine now')", [
          fx.editJobA,
          deliverablePath(fx.clientA, fx.editJobA, "probe"),
        ]),
      ),
    );
    await expectDenied(asUser(db, fx.editor, (s) => s.query("select public.request_revision($1, 'x')", [fx.editJobA])));
    await expectDenied(asUser(db, fx.editor, (s) => s.query("select public.approve_cut($1, 'x')", [fx.editJobA])));
  });

  it("can add notes to their own job thread only", async () => {
    await asUser(db, fx.editor, (s) =>
      s.query("insert into public.job_messages (job_id, client_id, body) values ($1, $2, 'Which font?')", [
        fx.editJobA,
        fx.clientA,
      ]),
    );
    await expectDenied(
      asUser(db, fx.editor, (s) =>
        s.query("insert into public.job_messages (job_id, client_id, body) values ($1, $2, 'hi')", [
          fx.editJobB,
          fx.clientB,
        ]),
      ),
    );
    await expectDenied(
      asUser(db, fx.editor, (s) =>
        s.query(
          "insert into public.job_messages (job_id, client_id, kind, body) values ($1, $2, 'revision_request', 'x')",
          [fx.editJobA, fx.clientA],
        ),
      ),
    );
    const thread = await asUser(db, fx.editor, (s) =>
      s.query<{ job_id: string }>("select job_id from public.job_messages"),
    );
    expect(new Set(thread.map((m) => m.job_id))).toEqual(new Set([fx.editJobA]));
  });

  it("can only write audit events for clients they have a job with", async () => {
    await asUser(db, fx.editor, (s) =>
      s.query("select public.log_event($1, 'footage_uploads', $2, 'download_link')", [fx.clientA, fx.editClipA]),
    );
    await expectDenied(
      asUser(db, fx.editor, (s) =>
        s.query("select public.log_event($1, 'footage_uploads', $2, 'download_link')", [fx.clientB, fx.editClipB]),
      ),
    );
  });
});

describe("the edit, review and delivery loop", () => {
  const cut1 = () => deliverablePath(fx.clientA, fx.editJobA, "cut1");
  const cut2 = () => deliverablePath(fx.clientA, fx.editJobA, "cut2");
  const stage = async () => (await one<{ stage: string }>("select stage from public.scripts where id = $1", [fx.editA])).stage;

  it("starts, then refuses a submission with no uploaded cut", async () => {
    await asUser(db, fx.editor, (s) => s.query("select public.editor_start_job($1)", [fx.editJobA]));
    const job = await one<{ status: string; started_at: string | null }>(
      "select status, started_at from public.edit_jobs where id = $1",
      [fx.editJobA],
    );
    expect(job.status).toBe("in_progress");
    expect(job.started_at).not.toBeNull();
    expect(
      await errorCode(
        asUser(db, fx.editor, (s) => s.query("select public.editor_submit_cut($1, $2, null, '')", [fx.editJobA, cut1()])),
      ),
    ).toBe("23514");
  });

  it("submits a cut, which sends the script to review but shows the client nothing", async () => {
    await asUser(db, fx.editor, async (s) => {
      await s.query("insert into storage.objects (bucket_id, name) values ('deliverables', $1)", [cut1()]);
      await s.query("select public.editor_submit_cut($1, $2, null, 'First pass')", [fx.editJobA, cut1()]);
    });
    expect(await stage()).toBe("review");
    const clientFiles = await asUser(db, fx.userA, (s) =>
      s.query<{ name: string }>("select name from storage.objects where bucket_id = 'deliverables'"),
    );
    expect(clientFiles.map((f) => f.name)).not.toContain(cut1());
    const clientDeliverables = await asUser(db, fx.userA, (s) =>
      s.query<{ id: string }>("select id from public.deliverables"),
    );
    expect(ids(clientDeliverables)).toEqual(new Set([fx.deliverableA]));
  });

  it("counts each revision request and reopens the job", async () => {
    expect(
      await errorCode(asUser(db, fx.team, (s) => s.query("select public.request_revision($1, '  ')", [fx.editJobA]))),
    ).toBe("23514");
    await asUser(db, fx.team, (s) => s.query("select public.request_revision($1, 'Tighten the intro')", [fx.editJobA]));
    const job = await one<{ status: string; revision_count: number }>(
      "select status, revision_count from public.edit_jobs where id = $1",
      [fx.editJobA],
    );
    expect(job).toEqual({ status: "revision", revision_count: 1 });
    expect(await stage()).toBe("in_edit");
    // Cannot ask for another revision until a new cut comes in.
    expect(
      await errorCode(asUser(db, fx.team, (s) => s.query("select public.request_revision($1, 'again')", [fx.editJobA]))),
    ).toBe("23514");
    const thread = await asUser(db, fx.editor, (s) =>
      s.query<{ kind: string; body: string }>(
        "select kind, body from public.job_messages where job_id = $1 and kind = 'revision_request'",
        [fx.editJobA],
      ),
    );
    expect(thread).toEqual([{ kind: "revision_request", body: "Tighten the intro" }]);
  });

  it("delivers on approval: the client gets exactly that file, and the editor's access ends", async () => {
    await asUser(db, fx.editor, async (s) => {
      await s.query("insert into storage.objects (bucket_id, name) values ('deliverables', $1)", [cut2()]);
      await s.query("select public.editor_submit_cut($1, $2, null, 'Second pass')", [fx.editJobA, cut2()]);
    });
    await asUser(db, fx.team, (s) => s.query("select public.approve_cut($1, 'Caption for the post')", [fx.editJobA]));

    expect(await stage()).toBe("delivered");
    const job = await one<{ status: string }>("select status from public.edit_jobs where id = $1", [fx.editJobA]);
    expect(job.status).toBe("done");

    const delivered = await asUser(db, fx.userA, (s) =>
      s.query<{ file_path: string; caption_draft: string }>(
        "select file_path, caption_draft from public.deliverables where edit_job_id = $1",
        [fx.editJobA],
      ),
    );
    expect(delivered).toEqual([{ file_path: cut2(), caption_draft: "Caption for the post" }]);

    const clientFiles = await asUser(db, fx.userA, (s) =>
      s.query<{ name: string }>("select name from storage.objects where bucket_id = 'deliverables'"),
    );
    const names = clientFiles.map((f) => f.name);
    expect(names).toContain(cut2());
    expect(names).not.toContain(cut1()); // the rejected first cut stays hidden

    // Client B sees none of it.
    const other = await asUser(db, fx.userB, (s) =>
      s.query<{ name: string }>("select name from storage.objects where name like $1", [`${fx.clientA}/%`]),
    );
    expect(other).toEqual([]);

    // The job is done: the editor can no longer read the script or its clips.
    const scripts = await asUser(db, fx.editor, (s) => s.query("select id from public.scripts"));
    expect(scripts).toEqual([]);
    const clips = await asUser(db, fx.editor, (s) =>
      s.query("select name from storage.objects where bucket_id = 'footage'"),
    );
    expect(clips).toEqual([]);
  });

  it("lets a client mark only their own video as downloaded", async () => {
    await asUser(db, fx.userA, (s) => s.query("select public.client_mark_downloaded($1)", [fx.deliverableA]));
    const row = await one<{ client_downloaded_at: string | null }>(
      "select client_downloaded_at from public.deliverables where id = $1",
      [fx.deliverableA],
    );
    expect(row.client_downloaded_at).not.toBeNull();
    await expectDenied(asUser(db, fx.userA, (s) => s.query("select public.client_mark_downloaded($1)", [fx.deliverableB])));
    await asUser(db, fx.userA, (s) => s.query("update public.deliverables set caption_draft = 'hacked'"));
    const mine = await one<{ caption_draft: string }>("select caption_draft from public.deliverables where id = $1", [
      fx.deliverableA,
    ]);
    expect(mine.caption_draft).toBe("caption A");
  });
});

describe("creating and assigning jobs", () => {
  it("needs all footage in first, and only staff can do it", async () => {
    expect(
      await errorCode(
        asUser(db, fx.team, (s) => s.query("select public.create_edit_job($1, $2, null)", [fx.shootA, fx.editor])),
      ),
    ).toBe("23514");
    await expectDenied(
      asUser(db, fx.userA, (s) => s.query("select public.create_edit_job($1, $2, null)", [fx.shootA, fx.editor])),
    );
    await expectDenied(
      asUser(db, fx.editor, (s) => s.query("select public.create_edit_job($1, $2, null)", [fx.shootA, fx.editor])),
    );
  });

  it("creates the job, copies the label and style notes, and moves the script into edit", async () => {
    await db.query("update public.script_internal set style_notes = 'warm grade' where script_id = $1", [fx.shootA]);
    await db.query("update public.scripts set stage = 'footage_received' where id = $1", [fx.shootA]);
    // Only people with the editor role can be assigned.
    expect(
      await errorCode(
        asUser(db, fx.team, (s) => s.query("select public.create_edit_job($1, $2, null)", [fx.shootA, fx.team])),
      ),
    ).toBe("23514");
    const [{ id }] = await asUser(db, fx.team, (s) =>
      s.query<{ id: string }>("select public.create_edit_job($1, $2, '2027-01-15') as id", [fx.shootA, fx.editor]),
    );
    const job = await one<{ client_label: string; style_notes: string; status: string; editor_id: string }>(
      "select client_label, style_notes, status, editor_id from public.edit_jobs where id = $1",
      [id],
    );
    expect(job).toEqual({ client_label: "A Bakery", style_notes: "warm grade", status: "queued", editor_id: fx.editor });
    const script = await one<{ stage: string }>("select stage from public.scripts where id = $1", [fx.shootA]);
    expect(script.stage).toBe("in_edit");
  });

  it("keeps edit costs and access keys for admins only", async () => {
    const team = await asUser(db, fx.team, (s) => s.query("select * from public.edit_job_costs"));
    expect(team).toEqual([]);
    const admin = await asUser(db, fx.admin, (s) =>
      s.query<{ cost_cents: number }>("select cost_cents from public.edit_job_costs where job_id = $1", [fx.editJobA]),
    );
    expect(admin).toEqual([{ cost_cents: 2000 }]);

    await asUser(db, fx.admin, (s) =>
      s.query("insert into public.editor_access_keys (editor_id, label, key_hash, key_prefix) values ($1, 'Claude', $2, 'vcc_ed_x')", [
        fx.editor,
        randomUUID(),
      ]),
    );
    for (const user of [fx.team, fx.editor, fx.userA]) {
      const rows = await asUser(db, user, (s) => s.query("select * from public.editor_access_keys"));
      expect(rows).toEqual([]);
    }
  });

  it("includes two revisions per video by default", async () => {
    const settings = await one<{ revision_allowance: number | null }>("select revision_allowance from public.app_settings", []);
    expect(settings.revision_allowance).toBe(2);
  });
});
