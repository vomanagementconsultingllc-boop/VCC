import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addShoot, createWorld, destroyWorld, service, type World } from "./helpers";

/**
 * The editor role end to end against a running Supabase stack: an editor
 * signs in for real, reads only their job's clips from storage, uploads a
 * cut, and the client only gets the file once the team approves it.
 */
let w: World;
let a: Awaited<ReturnType<typeof addShoot>>;
let jobId = "";
let clipPath = "";

const clip = () => new Blob([readFileSync(join(__dirname, "..", "fixtures", "video", "portrait-audio.mp4"))], { type: "video/mp4" });

beforeAll(async () => {
  w = await createWorld();
  a = await addShoot(w, "A");
  // Footage for both shots, already checked, so the job can be created.
  for (const shot of [a.shot1, a.shot2]) {
    const id = randomUUID();
    const path = `${a.clientId}/${a.scriptId}/${shot}/${id}.mp4`;
    if (shot === a.shot1) clipPath = path;
    const up = await service.storage.from("footage").upload(path, clip());
    if (up.error) throw new Error(`seed footage: ${up.error.message}`);
    const { error } = await service.from("footage_uploads").insert({
      id,
      script_id: a.scriptId,
      shot_id: shot,
      client_id: a.clientId,
      storage_path: path,
      uploaded_by: null,
      check_status: "passed",
    });
    if (error) throw new Error(`seed footage row: ${error.message}`);
  }
  const { data, error } = await w.sessions.team.rpc("create_edit_job", {
    p_script_id: a.scriptId,
    p_editor_id: w.editor,
    p_due_date: null as unknown as string,
  });
  if (error || !data) throw new Error(`create job: ${error?.message}`);
  jobId = data;
});

afterAll(async () => {
  if (w) await destroyWorld(w);
});

describe("an editor with an assigned job", () => {
  it("can download that job's raw clips, and another editor cannot", async () => {
    const mine = await w.sessions.editor.storage.from("footage").createSignedUrl(clipPath, 60);
    expect(mine.error).toBeNull();
    const res = await fetch(mine.data!.signedUrl, { headers: { Range: "bytes=0-9" } });
    expect([200, 206]).toContain(res.status);

    const theirs = await w.sessions.otherEditor.storage.from("footage").createSignedUrl(clipPath, 60);
    expect(theirs.error).not.toBeNull();
    const jobs = await w.sessions.otherEditor.from("edit_jobs").select("id");
    expect(jobs.data).toEqual([]);
  });

  it("uploads a cut into the job folder only, and the client cannot see it before approval", async () => {
    const cut = `${a.clientId}/${jobId}/${randomUUID()}.mp4`;
    const ok = await w.sessions.editor.storage.from("deliverables").upload(cut, clip());
    expect(ok.error).toBeNull();
    const outside = await w.sessions.editor.storage.from("deliverables").upload(`${a.clientId}/${randomUUID()}/x.mp4`, clip());
    expect(outside.error).not.toBeNull();
    const intruder = await w.sessions.otherEditor.storage.from("deliverables").upload(`${a.clientId}/${jobId}/y.mp4`, clip());
    expect(intruder.error).not.toBeNull();

    const submit = await w.sessions.editor.rpc("editor_submit_cut", {
      p_job_id: jobId,
      p_path: cut,
      p_alt_path: null as unknown as string,
      p_notes: "First pass",
    });
    expect(submit.error).toBeNull();

    const early = await w.sessions.a.storage.from("deliverables").createSignedUrl(cut, 60);
    expect(early.error).not.toBeNull();

    const approve = await w.sessions.team.rpc("approve_cut", { p_job_id: jobId, p_caption: "Caption" });
    expect(approve.error).toBeNull();

    const delivered = await w.sessions.a.storage.from("deliverables").createSignedUrl(cut, 60);
    expect(delivered.error).toBeNull();
    const other = await w.sessions.b.storage.from("deliverables").createSignedUrl(cut, 60);
    expect(other.error).not.toBeNull();

    // Job done: the editor's access to the raw footage is over.
    const after = await w.sessions.editor.storage.from("footage").createSignedUrl(clipPath, 60);
    expect(after.error).not.toBeNull();
  });
});
