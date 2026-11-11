import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { evaluateFootage } from "@/lib/footage/checks";
import { probeUrl } from "@/lib/footage/probe";
import { addShoot, anonymous, createWorld, destroyWorld, service, type World } from "./helpers";

/**
 * Footage storage, end to end against a running Supabase stack: real
 * sign-ins, real uploads into the private bucket, real signed URLs.
 */
let w: World;
let a: Awaited<ReturnType<typeof addShoot>>;
let b: Awaited<ReturnType<typeof addShoot>>;

const clip = (name: string) =>
  new Blob([readFileSync(join(__dirname, "..", "fixtures", "video", name))], { type: "video/mp4" });
const pathFor = (s: { clientId: string; scriptId: string }, shotId: string, id = randomUUID()) =>
  `${s.clientId}/${s.scriptId}/${shotId}/${id}.mp4`;

beforeAll(async () => {
  w = await createWorld();
  a = await addShoot(w, "A");
  b = await addShoot(w, "B");
});

afterAll(async () => {
  if (w) await destroyWorld(w);
});

describe("uploading footage", () => {
  const uploadId = randomUUID();
  let ownPath = "";

  it("works into the client's own open slot", async () => {
    ownPath = pathFor(a, a.shot1, uploadId);
    const { error } = await w.sessions.a.storage.from("footage").upload(ownPath, clip("portrait-audio.mp4"));
    expect(error).toBeNull();
  });

  it("is refused into another client's slot, or anywhere outside a slot", async () => {
    const other = await w.sessions.a.storage.from("footage").upload(pathFor(b, b.shot1), clip("portrait-audio.mp4"));
    expect(other.error).not.toBeNull();
    const loose = await w.sessions.a.storage.from("footage").upload(`${w.clientA}/loose.mp4`, clip("portrait-audio.mp4"));
    expect(loose.error).not.toBeNull();
    const anon = await anonymous().storage.from("footage").upload(pathFor(a, a.shot2), clip("portrait-audio.mp4"));
    expect(anon.error).not.toBeNull();
  });

  it("cannot be read by another client, an unassigned editor, or the public", async () => {
    for (const session of [w.sessions.b, w.sessions.editor]) {
      const signed = await session.storage.from("footage").createSignedUrl(ownPath, 60);
      expect(signed.error).not.toBeNull();
      const download = await session.storage.from("footage").download(ownPath);
      expect(download.error).not.toBeNull();
    }
    const { data } = anonymous().storage.from("footage").getPublicUrl(ownPath);
    const res = await fetch(data.publicUrl);
    expect(res.ok).toBe(false);
  });

  it("can be recorded, checked through a signed URL, and moves the script on when every shot passes", async () => {
    const insert = await w.sessions.a.from("footage_uploads").insert({
      id: uploadId,
      script_id: a.scriptId,
      shot_id: a.shot1,
      client_id: a.clientId,
      storage_path: ownPath,
      check_status: "passed", // ignored: the uploader cannot pass their own clip
    });
    expect(insert.error).toBeNull();
    const { data: row } = await service.from("footage_uploads").select("check_status").eq("id", uploadId).single();
    expect(row?.check_status).toBe("pending");

    // The server-side check: probe the file through a short-lived signed URL.
    const { data: signed } = await service.storage.from("footage").createSignedUrl(ownPath, 60);
    const probe = await probeUrl(signed!.signedUrl);
    expect(evaluateFootage(probe, { orientation: "portrait", minDurationSeconds: 5 })).toEqual([]);
    await service.from("footage_uploads").update({ check_status: "passed" }).eq("id", uploadId);

    // Second shot: a landscape clip fails the check and the script stays put.
    const second = randomUUID();
    const secondPath = pathFor(a, a.shot2, second);
    await w.sessions.a.storage.from("footage").upload(secondPath, clip("landscape-audio.mp4"));
    await w.sessions.a.from("footage_uploads").insert({
      id: second,
      script_id: a.scriptId,
      shot_id: a.shot2,
      client_id: a.clientId,
      storage_path: secondPath,
    });
    const { data: signed2 } = await service.storage.from("footage").createSignedUrl(secondPath, 60);
    const flags = evaluateFootage(await probeUrl(signed2!.signedUrl), { orientation: "portrait", minDurationSeconds: 5 });
    expect(flags).toEqual(["wrong_orientation"]);
    await service.from("footage_uploads").update({ check_status: "failed", flags }).eq("id", second);
    let script = await service.from("scripts").select("stage").eq("id", a.scriptId).single();
    expect(script.data?.stage).toBe("awaiting_footage");

    // Reshoot passes: the script moves to footage_received on its own.
    const third = randomUUID();
    const thirdPath = pathFor(a, a.shot2, third);
    await w.sessions.a.storage.from("footage").upload(thirdPath, clip("portrait-audio.mp4"));
    await w.sessions.a.from("footage_uploads").insert({
      id: third,
      script_id: a.scriptId,
      shot_id: a.shot2,
      client_id: a.clientId,
      storage_path: thirdPath,
    });
    await service.from("footage_uploads").update({ check_status: "passed" }).eq("id", third);
    script = await service.from("scripts").select("stage").eq("id", a.scriptId).single();
    expect(script.data?.stage).toBe("footage_received");
  });

  it("gives the owner a signed link that works, and that is the only way in", async () => {
    const signed = await w.sessions.a.storage.from("footage").createSignedUrl(ownPath, 60);
    expect(signed.error).toBeNull();
    const res = await fetch(signed.data!.signedUrl, { headers: { Range: "bytes=0-9" } });
    expect([200, 206]).toContain(res.status);
  });
});
