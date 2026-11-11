"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireEditor, requireRole, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { dollarsToCents, isUuid, text, type ActionState } from "@/lib/forms";
import { BUCKETS, MAX_UPLOAD_BYTES, formatBytes, videoExtension } from "@/lib/storage";

const dateOrNull = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
/** Database functions raise 23514 with a message written for people. */
const explain = (error: { code?: string; message: string }, fallback: string) =>
  error.code === "23514" ? error.message : fallback;

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export async function createJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const scriptId = text(formData, "script_id");
  const editorId = text(formData, "editor_id");
  if (!isUuid(scriptId)) return { error: "Unknown script." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_edit_job", {
    p_script_id: scriptId,
    // An empty choice leaves the job in the queue, unassigned.
    p_editor_id: (isUuid(editorId) ? editorId : null) as string,
    p_due_date: dateOrNull(text(formData, "due_date")) as string,
  });
  if (error || !data) return { error: explain(error ?? { message: "" }, "Could not create the job. Try again.") };
  redirect(`/team/jobs/${data}`);
}

export async function updateJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const id = text(formData, "job_id");
  const editorId = text(formData, "editor_id");
  if (!isUuid(id)) return { error: "Unknown job." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("edit_jobs")
    .update({
      editor_id: isUuid(editorId) ? editorId : null,
      due_date: dateOrNull(text(formData, "due_date")),
      style_notes: text(formData, "style_notes"),
    })
    .eq("id", id);
  if (error) return { error: explain(error, "Could not save the job.") };
  refresh();
  return { ok: "Saved." };
}

export async function saveJobCost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = text(formData, "job_id");
  const cents = dollarsToCents(text(formData, "cost"));
  if (!isUuid(id)) return { error: "Unknown job." };
  if (cents == null) return { error: "Enter the cost in dollars, for example 20." };
  const supabase = await createClient();
  const { error } = await supabase.from("edit_job_costs").update({ cost_cents: cents }).eq("job_id", id);
  if (error) return { error: "Could not save the cost." };
  refresh();
  return { ok: "Saved." };
}

export async function requestRevision(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const id = text(formData, "job_id");
  if (!isUuid(id)) return { error: "Unknown job." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_revision", { p_job_id: id, p_note: text(formData, "note") });
  if (error) return { error: explain(error, "Could not send the revision request.") };
  refresh();
  return { ok: "Revision requested. The editor has been told what to change." };
}

export async function approveCut(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const id = text(formData, "job_id");
  if (!isUuid(id)) return { error: "Unknown job." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_cut", { p_job_id: id, p_caption: text(formData, "caption") });
  if (error) return { error: explain(error, "Could not approve the cut.") };
  refresh();
  return { ok: "Approved and delivered to the client." };
}

// ---------------------------------------------------------------------------
// Team and editors
// ---------------------------------------------------------------------------
export async function addJobNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin", "team", "editor");
  const id = text(formData, "job_id");
  const body = text(formData, "body");
  if (!isUuid(id)) return { error: "Unknown job." };
  if (!body) return { error: "Write a note first." };
  const supabase = await createClient();
  const { data: job } = await supabase.from("edit_jobs").select("client_id").eq("id", id).maybeSingle();
  if (!job) return { error: "This job is not available." };
  const { error } = await supabase.from("job_messages").insert({ job_id: id, client_id: job.client_id, body });
  if (error) return { error: "Could not post the note." };
  refresh();
  return { ok: "Posted." };
}

// ---------------------------------------------------------------------------
// Editors
// ---------------------------------------------------------------------------
export async function startJob(formData: FormData): Promise<void> {
  await requireEditor();
  const id = text(formData, "job_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.rpc("editor_start_job", { p_job_id: id });
  refresh();
}

export type CutTicket = { error: string } | { bucket: string; path: string; endpoint: string };

/** Where a finished cut goes: deliverables/{client}/{job}/{file}. Chosen by the server. */
export async function beginCutUpload(input: { jobId: string; fileName: string; sizeBytes: number }): Promise<CutTicket> {
  await requireEditor();
  if (!isUuid(input.jobId)) return { error: "Unknown job." };
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) return { error: "That file is empty." };
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    return { error: `That file is ${formatBytes(input.sizeBytes)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.` };
  }
  const supabase = await createClient();
  // Row level security: an editor only finds jobs assigned to them.
  const { data: job } = await supabase.from("edit_jobs").select("id, client_id, status").eq("id", input.jobId).maybeSingle();
  if (!job) return { error: "This job is not available." };
  if (job.status === "done" || job.status === "submitted") return { error: "This job is not open for a new cut." };
  return {
    bucket: BUCKETS.deliverables,
    path: `${job.client_id}/${job.id}/${randomUUID()}.${videoExtension(input.fileName)}`,
    endpoint: `${publicEnv.supabaseUrl}/storage/v1/upload/resumable`,
  };
}

export async function submitCut(input: {
  jobId: string;
  path: string;
  altPath: string | null;
  notes: string;
}): Promise<ActionState> {
  await requireEditor();
  if (!isUuid(input.jobId)) return { error: "Unknown job." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("editor_submit_cut", {
    p_job_id: input.jobId,
    p_path: input.path,
    p_alt_path: input.altPath as string,
    p_notes: input.notes.slice(0, 5000),
  });
  if (error) return { error: explain(error, "Could not submit the cut. Try again.") };
  refresh();
  return { ok: "Submitted for review." };
}
