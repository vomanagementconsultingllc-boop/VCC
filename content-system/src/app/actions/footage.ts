"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { requireRole, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { isUuid, text } from "@/lib/forms";
import { describeFlag } from "@/lib/footage/checks";
import { runFootageCheck } from "@/lib/footage/run-check";
import { BUCKETS, MAX_UPLOAD_BYTES, footageObjectPath, formatBytes } from "@/lib/storage";

export type UploadTicket =
  | { error: string }
  | { uploadId: string; bucket: string; path: string; endpoint: string };

/**
 * Step 1 of an upload: decide where the file goes. The path is chosen by the
 * server from the shot (which row level security has already scoped to this
 * user), never from anything the browser sends.
 */
export async function beginFootageUpload(input: {
  shotId: string;
  fileName: string;
  sizeBytes: number;
}): Promise<UploadTicket> {
  const user = await requireRole("client", "admin", "team");
  if (!isUuid(input.shotId)) return { error: "Unknown shot." };
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) return { error: "That file is empty." };
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    return { error: `That file is ${formatBytes(input.sizeBytes)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.` };
  }

  const supabase = await createClient();
  const { data: shot } = await supabase
    .from("shots")
    .select("id, script_id, client_id")
    .eq("id", input.shotId)
    .maybeSingle();
  if (!shot) return { error: "This shot is no longer available." };

  if (user.role === "client") {
    const { data: script } = await supabase.from("scripts").select("stage").eq("id", shot.script_id).maybeSingle();
    if (script?.stage !== "awaiting_footage") {
      return { error: "Uploads for this video are closed. Message the team if you need to send a new clip." };
    }
  }

  const uploadId = randomUUID();
  return {
    uploadId,
    bucket: BUCKETS.footage,
    path: footageObjectPath({
      clientId: shot.client_id,
      scriptId: shot.script_id,
      shotId: shot.id,
      uploadId,
      fileName: input.fileName,
    }),
    endpoint: `${publicEnv.supabaseUrl}/storage/v1/upload/resumable`,
  };
}

export type UploadOutcome =
  | { error: string }
  | { status: "passed" | "failed" | "pending"; problems: string[] };

/**
 * Step 2, after the file is in storage: record it against the shot and run
 * the auto-checks straight away, so the client hears about a problem while
 * they still have the phone in their hand.
 */
export async function completeFootageUpload(input: {
  uploadId: string;
  shotId: string;
  path: string;
  fileName: string;
  sizeBytes: number;
}): Promise<UploadOutcome> {
  await requireRole("client", "admin", "team");
  if (!isUuid(input.uploadId) || !isUuid(input.shotId)) return { error: "Unknown upload." };

  const supabase = await createClient();
  const { data: shot } = await supabase
    .from("shots")
    .select("id, script_id, client_id, orientation, min_duration_seconds")
    .eq("id", input.shotId)
    .maybeSingle();
  if (!shot) return { error: "This shot is no longer available." };

  const expected = footageObjectPath({
    clientId: shot.client_id,
    scriptId: shot.script_id,
    shotId: shot.id,
    uploadId: input.uploadId,
    fileName: input.fileName,
  });
  if (input.path !== expected) return { error: "That upload does not match this shot." };

  // Inserted as the signed-in user: the database refuses it unless the script
  // is theirs, open for footage, and the file really exists in storage.
  const { error } = await supabase.from("footage_uploads").insert({
    id: input.uploadId,
    script_id: shot.script_id,
    shot_id: shot.id,
    client_id: shot.client_id,
    storage_path: expected,
    original_name: input.fileName.slice(0, 200),
    size_bytes: Math.round(input.sizeBytes),
  });
  if (error) return { error: "The upload finished but could not be saved. Please try again." };

  const result = await runFootageCheck(input.uploadId);
  refresh();

  const requirement = { orientation: shot.orientation, minDurationSeconds: shot.min_duration_seconds };
  const { data: checked } = await supabase
    .from("footage_uploads")
    .select("duration_seconds")
    .eq("id", input.uploadId)
    .maybeSingle();
  return {
    status: result.status,
    problems: result.flags.map((flag) =>
      describeFlag(flag, requirement, { durationSeconds: checked?.duration_seconds ?? null }),
    ),
  };
}

/** Team: accept a clip the auto-check flagged (it is not always right). */
export async function acceptFootage(formData: FormData): Promise<void> {
  await requireStaff();
  const id = text(formData, "upload_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase
    .from("footage_uploads")
    .update({ check_status: "passed", flags: [], checked_at: new Date().toISOString() })
    .eq("id", id);
  refresh();
}

/** Team: send a shot back to the client. Their slot reopens and says why. */
export async function requestReshoot(formData: FormData): Promise<void> {
  await requireStaff();
  const id = text(formData, "upload_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase
    .from("footage_uploads")
    .update({ check_status: "failed", flags: ["reshoot_requested"], checked_at: new Date().toISOString() })
    .eq("id", id);
  refresh();
}

/** Team: run the auto-check again (for example after a check timed out). */
export async function recheckFootage(formData: FormData): Promise<void> {
  await requireStaff();
  const id = text(formData, "upload_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  const { data } = await supabase.from("footage_uploads").select("id").eq("id", id).maybeSingle();
  if (!data) return;
  await runFootageCheck(id);
  refresh();
}
