import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS } from "@/lib/storage";
import { evaluateFootage, type FootageFlag } from "./checks";
import { probeUrl } from "./probe";

export type CheckResult = { status: "passed" | "failed" | "pending"; flags: FootageFlag[] };

/**
 * Run the auto-checks on one upload and store the verdict.
 *
 * Uses the service role (the uploader is not allowed to write check results),
 * so callers must already have established that the current user may act on
 * this upload: either they just inserted it under row level security, or
 * they are staff.
 */
export async function runFootageCheck(uploadId: string): Promise<CheckResult> {
  const admin = createAdminClient();
  const { data: upload } = await admin
    .from("footage_uploads")
    .select("id, storage_path, shot_id")
    .eq("id", uploadId)
    .maybeSingle();
  if (!upload) return { status: "pending", flags: [] };

  const { data: shot } = await admin
    .from("shots")
    .select("orientation, min_duration_seconds")
    .eq("id", upload.shot_id)
    .maybeSingle();
  if (!shot) return { status: "pending", flags: [] };

  // Short-lived link, used only by this server to read the file's header.
  const { data: signed } = await admin.storage.from(BUCKETS.footage).createSignedUrl(upload.storage_path, 120);
  if (!signed?.signedUrl) return { status: "pending", flags: [] };

  let probe;
  try {
    probe = await withTimeout(probeUrl(signed.signedUrl), 25_000);
  } catch {
    // Leave it pending; the periodic sweep or a manual re-check picks it up.
    return { status: "pending", flags: [] };
  }

  const flags = evaluateFootage(probe, {
    orientation: shot.orientation,
    minDurationSeconds: shot.min_duration_seconds,
  });
  const status = flags.length ? "failed" : "passed";
  const { error } = await admin
    .from("footage_uploads")
    .update({
      duration_seconds: probe.durationSeconds,
      width: probe.width,
      height: probe.height,
      has_audio: probe.hasAudio,
      flags,
      check_status: status,
      checked_at: new Date().toISOString(),
    })
    .eq("id", uploadId);
  if (error) return { status: "pending", flags: [] };
  return { status, flags };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
