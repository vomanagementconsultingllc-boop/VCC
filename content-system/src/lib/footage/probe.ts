import "server-only";
import mediaInfoFactory, { type ReadChunkFunc } from "mediainfo.js";
import type { Probe } from "./checks";

/**
 * Read a video's duration, dimensions and audio presence without downloading
 * it: MediaInfo asks for the few byte ranges it needs (the container header,
 * which phones often write at the END of the file) and we fetch just those.
 */
export async function probeMedia(size: number, readChunk: ReadChunkFunc): Promise<Probe> {
  const empty: Probe = { hasVideo: false, hasAudio: false, durationSeconds: null, width: null, height: null };
  if (!Number.isFinite(size) || size <= 0) return empty;

  const mediainfo = await mediaInfoFactory({ format: "object", chunkSize: 512 * 1024 });
  try {
    const result = await mediainfo.analyzeData(size, readChunk);
    const tracks = result.media?.track ?? [];
    const general = tracks.find((t) => t["@type"] === "General");
    const video = tracks.find((t) => t["@type"] === "Video");
    const hasAudio = tracks.some((t) => t["@type"] === "Audio");
    if (!video) return { ...empty, hasAudio };

    let width = numberOrNull(video.Width);
    let height = numberOrNull(video.Height);
    // Phones record sideways and store a rotation; swap to what a viewer sees.
    const rotation = Math.abs(Math.round(Number(video.Rotation ?? 0))) % 180;
    if (rotation === 90) [width, height] = [height, width];

    const duration = numberOrNull(video.Duration) ?? numberOrNull(general?.Duration);
    return { hasVideo: true, hasAudio, durationSeconds: duration, width, height };
  } catch {
    return empty;
  } finally {
    mediainfo.close();
  }
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Probe a file behind a URL (a short-lived signed URL) using HTTP range requests. */
export async function probeUrl(url: string): Promise<Probe> {
  const head = await fetch(url, { headers: { Range: "bytes=0-0" }, cache: "no-store" });
  await head.arrayBuffer();
  const size = sizeFromHeaders(head);
  if (!head.ok || size == null) {
    return { hasVideo: false, hasAudio: false, durationSeconds: null, width: null, height: null };
  }
  return probeMedia(size, async (chunkSize, offset) => {
    const end = Math.min(offset + chunkSize, size) - 1;
    if (end < offset) return new Uint8Array();
    const res = await fetch(url, { headers: { Range: `bytes=${offset}-${end}` }, cache: "no-store" });
    if (!res.ok) throw new Error(`range request failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  });
}

function sizeFromHeaders(res: Response): number | null {
  // "bytes 0-0/12345" when ranges are honoured; otherwise the whole length.
  const range = res.headers.get("content-range");
  const total = range?.split("/")[1];
  if (total && total !== "*") {
    const n = Number(total);
    if (Number.isFinite(n)) return n;
  }
  if (res.status === 200) {
    const n = Number(res.headers.get("content-length"));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
