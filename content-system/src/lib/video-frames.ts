/**
 * Take a few still frames from a video file in the browser, evenly spaced
 * through the clip, as small JPEGs. These are what the b-roll review looks
 * at, so the full video never has to be decoded on the server.
 *
 * Returns an empty list if the browser cannot decode the file (the clip then
 * waits for a person to review it instead).
 */
export async function extractFrames(file: File, count: number, maxSide = 768): Promise<Blob[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  const waitFor = (event: string, ms: number) =>
    new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), ms);
      video.addEventListener(
        event,
        () => {
          clearTimeout(timer);
          resolve(true);
        },
        { once: true },
      );
      video.addEventListener("error", () => resolve(false), { once: true });
    });

  try {
    const ready = waitFor("loadeddata", 8000);
    video.src = url;
    if (!(await ready)) return [];
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0 || !video.videoWidth || !video.videoHeight) return [];

    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return [];

    const frames: Blob[] = [];
    for (let i = 0; i < count; i++) {
      const seeked = waitFor("seeked", 5000);
      // Middle of each equal slice, so the first and last frames are not black fades.
      video.currentTime = (duration * (i + 0.5)) / count;
      if (!(await seeked)) break;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
      if (blob) frames.push(blob);
    }
    return frames;
  } catch {
    return [];
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}
