import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/browser";
import { publicEnv } from "@/lib/env";

export type UploadTarget = { endpoint: string; bucket: string; path: string };

export type ResumableUpload = {
  start: () => void;
  abort: () => void;
};

/**
 * Chunked, resumable upload straight from the browser into a private
 * Supabase bucket. Chunks retry on a bad connection; if retries run out the
 * caller is told it stalled and can call start() again to carry on from
 * where it stopped. Storage policies decide whether the path is allowed.
 */
export function createResumableUpload(
  file: File,
  target: UploadTarget,
  handlers: { onProgress: (percent: number) => void; onStalled: () => void; onDone: () => void },
): ResumableUpload {
  const supabase = createClient();
  const upload = new tus.Upload(file, {
    endpoint: target.endpoint,
    // Supabase requires exactly 6 MB chunks for resumable uploads.
    chunkSize: 6 * 1024 * 1024,
    retryDelays: [0, 2000, 5000, 10000, 20000, 30000],
    uploadDataDuringCreation: true,
    storeFingerprintForResuming: false,
    headers: { apikey: publicEnv.supabaseKey, "x-upsert": "false" },
    metadata: {
      bucketName: target.bucket,
      objectName: target.path,
      contentType: file.type || "video/mp4",
      cacheControl: "3600",
    },
    // A long upload can outlive the hour-long access token: refresh it per request.
    onBeforeRequest: async (req) => {
      const { data } = await supabase.auth.getSession();
      req.setHeader("authorization", `Bearer ${data.session?.access_token ?? ""}`);
    },
    onProgress: (sent, total) => handlers.onProgress(total ? Math.floor((sent / total) * 100) : 0),
    onError: () => handlers.onStalled(),
    onSuccess: () => handlers.onDone(),
  });
  return {
    start: () => upload.start(),
    abort: () => void upload.abort(),
  };
}

/** Promise form, for uploading one file after another. */
export function uploadFile(
  file: File,
  target: UploadTarget,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    createResumableUpload(file, target, {
      onProgress,
      onStalled: () => reject(new Error("The connection dropped during the upload.")),
      onDone: () => resolve(),
    }).start();
  });
}
