/** Private buckets. Nothing in them is ever public; access is by signed URL only. */
export const BUCKETS = { footage: "footage", deliverables: "deliverables" } as const;

/** Every media link we hand out stops working after 15 minutes. */
export const SIGNED_URL_SECONDS = 15 * 60;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "avi", "mkv", "3gp"]);

export function videoExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTENSIONS.has(ext) ? ext : "mp4";
}

/** footage/{client}/{script}/{shot}/{upload}.{ext}: the client id always comes first. */
export function footageObjectPath(input: {
  clientId: string;
  scriptId: string;
  shotId: string;
  uploadId: string;
  fileName: string;
}): string {
  return `${input.clientId}/${input.scriptId}/${input.shotId}/${input.uploadId}.${videoExtension(input.fileName)}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
