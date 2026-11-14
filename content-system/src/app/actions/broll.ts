"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { requireRole, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { intOrNull, isUuid, text, type ActionState } from "@/lib/forms";
import { runBrollReview } from "@/lib/broll/run-review";
import { BROLL_FRAMES, BUCKETS, MAX_UPLOAD_BYTES, formatBytes, videoExtension } from "@/lib/storage";

const dateOrNull = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

// ---------------------------------------------------------------------------
// Team: the list of b-roll to shoot
// ---------------------------------------------------------------------------
export async function saveBrollRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const clientId = text(formData, "client_id");
  const id = text(formData, "request_id");
  const title = text(formData, "title");
  if (!isUuid(clientId)) return { error: "Unknown client." };
  if (!title) return { error: "Say what to shoot." };
  const fields = {
    title,
    instructions: text(formData, "instructions"),
    orientation: text(formData, "orientation") === "landscape" ? ("landscape" as const) : ("portrait" as const),
    min_duration_seconds: Math.min(600, Math.max(0, intOrNull(formData, "min_duration_seconds") ?? 5)),
    reference_url: text(formData, "reference_url"),
    due_date: dateOrNull(text(formData, "due_date")),
  };
  const supabase = await createClient();
  const { error } = isUuid(id)
    ? await supabase.from("broll_requests").update(fields).eq("id", id)
    : await supabase.from("broll_requests").insert({ client_id: clientId, ...fields });
  if (error) return { error: "Could not save. Try again." };
  refresh();
  return { ok: isUuid(id) ? "Saved." : "Added. The client can see it in their drop box now." };
}

export async function deleteBrollRequest(formData: FormData): Promise<void> {
  await requireStaff();
  const id = text(formData, "request_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("broll_requests").delete().eq("id", id);
  refresh();
}

/** Team verdict on a clip: accept it, or send it back with advice. Overrules the automatic review. */
export async function reviewBrollByTeam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const id = text(formData, "submission_id");
  const verdict = text(formData, "verdict");
  const advice = text(formData, "advice");
  if (!isUuid(id)) return { error: "Unknown clip." };
  if (verdict !== "accept" && verdict !== "reshoot") return { error: "Choose accept or reshoot." };
  if (verdict === "reshoot" && !advice) return { error: "Tell the client what to change." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("broll_submissions")
    .update({
      check_status: verdict === "accept" ? "passed" : "failed",
      flags: verdict === "accept" ? [] : ["reshoot_requested"],
      feedback: verdict === "accept" ? "" : advice,
      reviewed_by: "team",
      checked_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "Could not save. Try again." };
  refresh();
  return { ok: verdict === "accept" ? "Accepted." : "Sent back. The client sees your advice on their submission box." };
}

export async function rerunBrollReview(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const id = text(formData, "submission_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  const { data } = await supabase.from("broll_submissions").select("id").eq("id", id).maybeSingle();
  if (!data) return;
  await runBrollReview(id, user.id);
  refresh();
}

// ---------------------------------------------------------------------------
// Client (and team on their behalf): submitting a clip
// ---------------------------------------------------------------------------
export type BrollTicket =
  | { error: string }
  | { submissionId: string; bucket: string; path: string; framePaths: string[]; endpoint: string };

export async function beginBrollUpload(input: {
  requestId: string;
  fileName: string;
  sizeBytes: number;
  frameCount: number;
}): Promise<BrollTicket> {
  await requireRole("client", "admin", "team");
  if (!isUuid(input.requestId)) return { error: "Unknown item." };
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) return { error: "That file is empty." };
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    return { error: `That file is ${formatBytes(input.sizeBytes)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.` };
  }
  const supabase = await createClient();
  // Row level security: a client only finds requests in their own drop box.
  const { data: request } = await supabase
    .from("broll_requests")
    .select("id, client_id, status")
    .eq("id", input.requestId)
    .maybeSingle();
  if (!request) return { error: "This item is no longer in your drop box." };
  if (request.status === "accepted") return { error: "This one is already accepted. Nothing more to send." };

  const submissionId = randomUUID();
  const folder = `${request.client_id}/${request.id}`;
  const frames = Math.min(BROLL_FRAMES, Math.max(0, Math.floor(input.frameCount)));
  return {
    submissionId,
    bucket: BUCKETS.broll,
    path: `${folder}/${submissionId}.${videoExtension(input.fileName)}`,
    framePaths: Array.from({ length: frames }, (_, i) => `${folder}/${submissionId}-f${i + 1}.jpg`),
    endpoint: `${publicEnv.supabaseUrl}/storage/v1/upload/resumable`,
  };
}

export type BrollResult = { error: string } | { status: "passed" | "failed" | "pending"; advice: string };

export async function completeBrollUpload(input: {
  submissionId: string;
  requestId: string;
  path: string;
  framePaths: string[];
  fileName: string;
  sizeBytes: number;
}): Promise<BrollResult> {
  const user = await requireRole("client", "admin", "team");
  if (!isUuid(input.submissionId) || !isUuid(input.requestId)) return { error: "Unknown upload." };
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("broll_requests")
    .select("id, client_id")
    .eq("id", input.requestId)
    .maybeSingle();
  if (!request) return { error: "This item is no longer in your drop box." };

  const folder = `${request.client_id}/${request.id}/${input.submissionId}`;
  const expectedFrame = /^-f[1-9]\.jpg$/;
  if (
    input.path !== `${folder}.${videoExtension(input.fileName)}` ||
    input.framePaths.length > BROLL_FRAMES ||
    input.framePaths.some((p) => !p.startsWith(folder) || !expectedFrame.test(p.slice(folder.length)))
  ) {
    return { error: "That upload does not match this item." };
  }

  // Inserted as the signed-in user: the database refuses it unless the
  // request is theirs, still open, and the file really exists.
  const { error } = await supabase.from("broll_submissions").insert({
    id: input.submissionId,
    request_id: request.id,
    client_id: request.client_id,
    storage_path: input.path,
    frame_paths: input.framePaths,
    original_name: input.fileName.slice(0, 200),
    size_bytes: Math.round(input.sizeBytes),
  });
  if (error) return { error: "The upload finished but could not be saved. Please try again." };

  const outcome = await runBrollReview(input.submissionId, user.id);
  refresh();
  return outcome;
}
