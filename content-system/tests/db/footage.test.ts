import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, expectDenied, type Db } from "./harness";
import { cleanup, footagePath, seed, type Fixture } from "./fixtures";

/** Build step 3: footage rows and the private storage bucket. */
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

const stageOf = async (scriptId: string) =>
  (await db.query<{ stage: string }>("select stage from public.scripts where id = $1", [scriptId]))[0].stage;

describe("the footage bucket", () => {
  it("is private", async () => {
    const [bucket] = await db.query<{ public: boolean }>("select public from storage.buckets where id = 'footage'");
    expect(bucket.public).toBe(false);
  });

  it("lets a client see only files under their own client id", async () => {
    const rows = await asUser(db, fx.userA, (s) => s.query<{ name: string }>("select name from storage.objects"));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.name.startsWith(`${fx.clientA}/`)).toBe(true);
  });

  it("accepts a client upload only into their own script while it is waiting for footage", async () => {
    const own = footagePath(fx.clientA, fx.shootA, fx.shotA2, randomUUID());
    await asUser(db, fx.userA, (s) =>
      s.query("insert into storage.objects (bucket_id, name) values ('footage', $1)", [own]),
    );

    const refused = [
      // another client's open script
      footagePath(fx.clientB, fx.shootB, fx.shotB2, randomUUID()),
      // own client id in the path, but another client's script and shot
      footagePath(fx.clientA, fx.shootB, fx.shotB2, randomUUID()),
      // own script that is not open for footage (still waiting for approval)
      `${fx.clientA}/${fx.sentA}/${fx.shotA1}/${randomUUID()}.mp4`,
      // not the expected folder shape
      `${fx.clientA}/loose-file.mp4`,
      `${fx.clientA}/not-a-uuid/${fx.shotA2}/x.mp4`,
    ];
    for (const name of refused) {
      await expectDenied(
        asUser(db, fx.userA, (s) =>
          s.query("insert into storage.objects (bucket_id, name) values ('footage', $1)", [name]),
        ),
      );
    }
  });

  it("gives clients no way to delete or overwrite files, and editors and visitors nothing", async () => {
    await asUser(db, fx.userA, (s) => s.query("delete from storage.objects"));
    await asUser(db, fx.userA, (s) => s.query("update storage.objects set name = name || '.x'"));
    const [{ n }] = await db.query<{ n: number }>(
      "select count(*)::int as n from storage.objects where name = $1",
      [footagePath(fx.clientA, fx.shootA, fx.shotA1, fx.uploadA)],
    );
    expect(n).toBe(1);

    const editorRows = await asUser(db, fx.idleEditor, (s) => s.query("select * from storage.objects"));
    expect(editorRows).toEqual([]);
    const anonRows = await asUser(db, null, (s) => s.query("select * from storage.objects"));
    expect(anonRows).toEqual([]);
    await expectDenied(
      asUser(db, null, (s) =>
        s.query("insert into storage.objects (bucket_id, name) values ('footage', $1)", [
          footagePath(fx.clientA, fx.shootA, fx.shotA2, randomUUID()),
        ]),
      ),
    );
  });
});

describe("recording an upload", () => {
  const newUpload = randomUUID();

  it("is refused until the file is really in storage", async () => {
    const path = footagePath(fx.clientA, fx.shootA, fx.shotA1, randomUUID());
    const code = await errorCode(
      asUser(db, fx.userA, (s) =>
        s.query(
          "insert into public.footage_uploads (script_id, shot_id, client_id, storage_path) values ($1, $2, $3, $4)",
          [fx.shootA, fx.shotA1, fx.clientA, path],
        ),
      ),
    );
    expect(code).toBe("23514");
  });

  it("always starts unchecked, whatever the uploader claims, and replaces the earlier clip", async () => {
    const path = footagePath(fx.clientA, fx.shootA, fx.shotA1, newUpload);
    await asUser(db, fx.userA, async (s) => {
      await s.query("insert into storage.objects (bucket_id, name) values ('footage', $1)", [path]);
      await s.query(
        `insert into public.footage_uploads
           (id, script_id, shot_id, client_id, storage_path, check_status, has_audio, duration_seconds, uploaded_by)
         values ($1, $2, $3, $4, $5, 'passed', true, 99, $6)`,
        [newUpload, fx.shootA, fx.shotA1, fx.clientA, path, fx.admin],
      );
    });
    const [row] = await db.query<{
      check_status: string;
      has_audio: boolean | null;
      duration_seconds: string | null;
      uploaded_by: string;
      shot_number: number;
    }>("select check_status, has_audio, duration_seconds, uploaded_by, shot_number from public.footage_uploads where id = $1", [
      newUpload,
    ]);
    expect(row).toEqual({
      check_status: "pending",
      has_audio: null,
      duration_seconds: null,
      uploaded_by: fx.userA,
      shot_number: 1,
    });
    const [old] = await db.query<{ superseded: boolean }>(
      "select superseded from public.footage_uploads where id = $1",
      [fx.uploadA],
    );
    expect(old.superseded).toBe(true);
  });

  it("cannot be marked as passed by the client", async () => {
    await asUser(db, fx.userA, (s) => s.query("update public.footage_uploads set check_status = 'passed'"));
    const [row] = await db.query<{ check_status: string }>(
      "select check_status from public.footage_uploads where id = $1",
      [newUpload],
    );
    expect(row.check_status).toBe("pending");
  });

  it("is refused for another client's shot, or a shot from a different script", async () => {
    // The file exists (client B put it there), so only row level security stands in the way.
    const theirs = footagePath(fx.clientB, fx.shootB, fx.shotB2, randomUUID());
    await db.query("insert into storage.objects (bucket_id, name) values ('footage', $1)", [theirs]);
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query(
          "insert into public.footage_uploads (script_id, shot_id, client_id, storage_path) values ($1, $2, $3, $4)",
          [fx.shootB, fx.shotB2, fx.clientB, theirs],
        ),
      ),
    );
    const [{ n }] = await db.query<{ n: number }>(
      "select count(*)::int as n from public.footage_uploads where storage_path = $1",
      [theirs],
    );
    expect(n).toBe(0);
    const code = await errorCode(
      asUser(db, fx.team, (s) =>
        s.query(
          "insert into public.footage_uploads (script_id, shot_id, client_id, storage_path) values ($1, $2, $3, $4)",
          [fx.shootA, fx.shotB1, fx.clientA, footagePath(fx.clientA, fx.shootA, fx.shotB1, randomUUID())],
        ),
      ),
    );
    expect(code).toBe("23514");
  });

  it("moves the script on by itself once every shot has a clip that passed", async () => {
    expect(await stageOf(fx.shootA)).toBe("awaiting_footage");
    // The server-side check passes the re-uploaded shot 1...
    await db.query(
      "update public.footage_uploads set check_status = 'passed', checked_at = now() where id = $1",
      [newUpload],
    );
    expect(await stageOf(fx.shootA)).toBe("awaiting_footage");
    // ...and then shot 2 arrives and passes.
    const second = randomUUID();
    const path = footagePath(fx.clientA, fx.shootA, fx.shotA2, second);
    await asUser(db, fx.userA, async (s) => {
      await s.query("insert into storage.objects (bucket_id, name) values ('footage', $1)", [path]);
      await s.query(
        "insert into public.footage_uploads (id, script_id, shot_id, client_id, storage_path) values ($1, $2, $3, $4, $5)",
        [second, fx.shootA, fx.shotA2, fx.clientA, path],
      );
    });
    await db.query("update public.footage_uploads set check_status = 'passed', checked_at = now() where id = $1", [
      second,
    ]);
    expect(await stageOf(fx.shootA)).toBe("footage_received");
    const [script] = await db.query<{ footage_received_at: string | null }>(
      "select footage_received_at from public.scripts where id = $1",
      [fx.shootA],
    );
    expect(script.footage_received_at).not.toBeNull();

    // Uploads close once everything is in.
    await expectDenied(
      asUser(db, fx.userA, (s) =>
        s.query("insert into storage.objects (bucket_id, name) values ('footage', $1)", [
          footagePath(fx.clientA, fx.shootA, fx.shotA2, randomUUID()),
        ]),
      ),
    );
  });

  it("reopens the slot when the team asks for a reshoot", async () => {
    await asUser(db, fx.team, (s) =>
      s.query(
        "update public.footage_uploads set check_status = 'failed', flags = '{reshoot_requested}' where id = $1",
        [newUpload],
      ),
    );
    expect(await stageOf(fx.shootA)).toBe("awaiting_footage");
  });
});

describe("editors", () => {
  it("see no footage until a job is assigned to them", async () => {
    const rows = await asUser(db, fx.idleEditor, (s) => s.query("select * from public.footage_uploads"));
    expect(rows).toEqual([]);
  });
});
