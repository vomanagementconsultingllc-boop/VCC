import { createServer, type Server } from "node:http";
import { openSync, readSync, closeSync, statSync, createReadStream } from "node:fs";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { describeFlag, evaluateFootage, type Probe } from "@/lib/footage/checks";
import { probeMedia, probeUrl } from "@/lib/footage/probe";

const dir = join(__dirname, "..", "fixtures", "video");

/** Probe a local file the same way the server probes storage: by byte range. */
function probeFile(name: string): Promise<Probe> {
  const path = join(dir, name);
  const size = statSync(path).size;
  return probeMedia(size, (chunkSize, offset) => {
    const fd = openSync(path, "r");
    try {
      const buffer = new Uint8Array(Math.min(chunkSize, size - offset));
      readSync(fd, buffer, 0, buffer.length, offset);
      return buffer;
    } finally {
      closeSync(fd);
    }
  });
}

const portrait5s = { orientation: "portrait", minDurationSeconds: 5 } as const;

describe("probing real clips", () => {
  it("reads a normal portrait clip with sound", async () => {
    const probe = await probeFile("portrait-audio.mp4");
    expect(probe).toMatchObject({ hasVideo: true, hasAudio: true, width: 72, height: 128 });
    expect(probe.durationSeconds).toBeCloseTo(6, 0);
    expect(evaluateFootage(probe, portrait5s)).toEqual([]);
  });

  it("applies the rotation a phone stores, so a sideways-encoded upright video counts as portrait", async () => {
    const probe = await probeFile("phone-rotated.mov");
    expect(probe).toMatchObject({ hasVideo: true, hasAudio: true, width: 72, height: 128 });
    expect(evaluateFootage(probe, portrait5s)).toEqual([]);
    expect(evaluateFootage(probe, { orientation: "landscape", minDurationSeconds: 5 })).toEqual(["wrong_orientation"]);
  });

  it("flags a landscape clip for a portrait shot", async () => {
    const probe = await probeFile("landscape-audio.mp4");
    expect(evaluateFootage(probe, portrait5s)).toEqual(["wrong_orientation"]);
  });

  it("flags a clip with no audio track", async () => {
    const probe = await probeFile("portrait-silent.mp4");
    expect(probe.hasAudio).toBe(false);
    expect(evaluateFootage(probe, portrait5s)).toEqual(["silent"]);
  });

  it("flags a clip that is too short", async () => {
    const probe = await probeFile("portrait-short.mp4");
    expect(evaluateFootage(probe, portrait5s)).toEqual(["too_short"]);
    expect(evaluateFootage(probe, { orientation: "portrait", minDurationSeconds: 2 })).toEqual([]);
  });

  it("flags files that are not video at all", async () => {
    expect(evaluateFootage(await probeFile("not-a-video.mp4"), portrait5s)).toEqual(["unreadable"]);
    expect(evaluateFootage(await probeFile("audio-only.m4a"), portrait5s)).toEqual(["unreadable"]);
  });
});

describe("probing over HTTP range requests", () => {
  let server: Server;
  let base = "";
  let bytesServed = 0;

  beforeAll(async () => {
    // A tiny static server that honours Range, like signed storage URLs do.
    server = createServer((req, res) => {
      const path = join(dir, decodeURIComponent((req.url ?? "/").slice(1)));
      let size: number;
      try {
        size = statSync(path).size;
      } catch {
        res.writeHead(404).end();
        return;
      }
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
      if (!match) {
        res.writeHead(200, { "Content-Length": size });
        createReadStream(path).pipe(res);
        return;
      }
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      bytesServed += end - start + 1;
      res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
      createReadStream(path, { start, end }).pipe(res);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("gets the same answer as reading the file directly", async () => {
    expect(await probeUrl(`${base}/phone-rotated.mov`)).toEqual(await probeFile("phone-rotated.mov"));
    expect(await probeUrl(`${base}/portrait-silent.mp4`)).toEqual(await probeFile("portrait-silent.mp4"));
    expect(bytesServed).toBeGreaterThan(0);
  });

  it("treats a missing file as unreadable instead of throwing", async () => {
    const probe = await probeUrl(`${base}/nope.mp4`);
    expect(evaluateFootage(probe, portrait5s)).toEqual(["unreadable"]);
  });
});

describe("evaluateFootage", () => {
  const ok: Probe = { hasVideo: true, hasAudio: true, durationSeconds: 10, width: 1080, height: 1920 };

  it("reports every problem at once, so the client reshoots only once", () => {
    const probe: Probe = { hasVideo: true, hasAudio: false, durationSeconds: 1, width: 1920, height: 1080 };
    expect(evaluateFootage(probe, portrait5s)).toEqual(["too_short", "wrong_orientation", "silent"]);
  });

  it("allows a hair under the minimum and accepts square video for either orientation", () => {
    expect(evaluateFootage({ ...ok, durationSeconds: 4.9 }, portrait5s)).toEqual([]);
    expect(evaluateFootage({ ...ok, durationSeconds: 4.5 }, portrait5s)).toEqual(["too_short"]);
    expect(evaluateFootage({ ...ok, width: 1080, height: 1080 }, portrait5s)).toEqual([]);
    expect(evaluateFootage({ ...ok, durationSeconds: null }, portrait5s)).toEqual(["too_short"]);
  });

  it("explains each problem in words a client can act on", () => {
    expect(describeFlag("too_short", portrait5s, { durationSeconds: 2.2 })).toBe(
      "This clip is 2 seconds. This shot needs at least 5 seconds.",
    );
    expect(describeFlag("wrong_orientation", portrait5s)).toMatch(/upright/);
    expect(describeFlag("silent", portrait5s)).toMatch(/sound/);
  });
});
