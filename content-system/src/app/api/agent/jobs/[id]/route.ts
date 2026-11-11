import { randomUUID } from "node:crypto";
import { z } from "zod";
import { editorFromRequest } from "@/lib/agent-auth";
import { isUuid } from "@/lib/forms";
import { BUCKETS, SIGNED_URL_SECONDS, videoExtension } from "@/lib/storage";

/**
 * One job, for an editor seat using an access key.
 *
 *   GET  -> the brief: script, shots, style notes, the thread, and a signed
 *           15-minute download link for each raw clip (each one logged).
 *   POST -> { action: "start" }
 *           { action: "upload_url", file_name }        returns where to PUT the cut
 *           { action: "submit", path, alt_path?, notes? }
 *           { action: "note", body }
 */
export async function GET(request: Request, { params }: RouteContext<"/api/agent/jobs/[id]">) {
  const session = await editorFromRequest(request);
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Job not found." }, { status: 404 });
  const { supabase } = session;

  const { data: job } = await supabase
    .from("edit_jobs")
    .select("id, script_id, client_id, status, due_date, revision_count, client_label, style_notes")
    .eq("id", id)
    .maybeSingle();
  if (!job) return Response.json({ error: "Job not found." }, { status: 404 });

  const [{ data: script }, { data: shots }, { data: clips }, { data: messages }] = await Promise.all([
    supabase.from("scripts").select("title, hook, body, format").eq("id", job.script_id).maybeSingle(),
    supabase.from("shots").select("shot_number, instruction, lines, orientation").eq("script_id", job.script_id).order("shot_number"),
    supabase
      .from("footage_uploads")
      .select("id, shot_number, storage_path, original_name, size_bytes, duration_seconds, width, height")
      .eq("script_id", job.script_id)
      .eq("superseded", false)
      .eq("check_status", "passed")
      .order("shot_number"),
    supabase.from("job_messages").select("kind, body, created_at").eq("job_id", id).order("created_at"),
  ]);

  const footage = [];
  for (const clip of clips ?? []) {
    const ext = clip.storage_path.split(".").pop() ?? "mp4";
    const { data: signed } = await supabase.storage
      .from(BUCKETS.footage)
      .createSignedUrl(clip.storage_path, SIGNED_URL_SECONDS, { download: `shot-${clip.shot_number}.${ext}` });
    if (!signed?.signedUrl) continue;
    await supabase.rpc("log_event", {
      p_client_id: job.client_id,
      p_table: "footage_uploads",
      p_record_id: clip.id,
      p_action: "download_link",
      p_details: { via: "access_key" },
    });
    footage.push({
      shot_number: clip.shot_number,
      file_name: `shot-${clip.shot_number}.${ext}`,
      size_bytes: clip.size_bytes,
      duration_seconds: clip.duration_seconds,
      width: clip.width,
      height: clip.height,
      download_url: signed.signedUrl,
      expires_in_seconds: SIGNED_URL_SECONDS,
    });
  }

  return Response.json({
    job: {
      id: job.id,
      status: job.status,
      due_date: job.due_date,
      revision_count: job.revision_count,
      client_label: job.client_label,
      style_notes: job.style_notes,
    },
    script: script ?? null,
    shots: shots ?? [],
    footage,
    thread: messages ?? [],
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("upload_url"), file_name: z.string().min(1).max(200) }),
  z.object({
    action: z.literal("submit"),
    path: z.string().min(1).max(500),
    alt_path: z.string().min(1).max(500).nullish(),
    notes: z.string().max(5000).optional(),
  }),
  z.object({ action: z.literal("note"), body: z.string().trim().min(1).max(5000) }),
]);

export async function POST(request: Request, { params }: RouteContext<"/api/agent/jobs/[id]">) {
  const session = await editorFromRequest(request);
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Job not found." }, { status: 404 });
  const { supabase } = session;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Unknown action. Use start, upload_url, submit or note." }, { status: 400 });
  }
  const input = parsed.data;

  const { data: job } = await supabase.from("edit_jobs").select("id, client_id, status").eq("id", id).maybeSingle();
  if (!job) return Response.json({ error: "Job not found." }, { status: 404 });

  const fail = (error: { code?: string; message: string }) =>
    Response.json({ error: error.code === "23514" ? error.message : "That did not work." }, { status: 409 });

  switch (input.action) {
    case "start": {
      const { error } = await supabase.rpc("editor_start_job", { p_job_id: id });
      return error ? fail(error) : Response.json({ ok: true, status: "in_progress" });
    }
    case "upload_url": {
      if (job.status === "done" || job.status === "submitted") {
        return Response.json({ error: "This job is not open for a new cut." }, { status: 409 });
      }
      // The path is chosen here, inside the job's own folder; storage policy
      // refuses anything outside it.
      const path = `${job.client_id}/${job.id}/${randomUUID()}.${videoExtension(input.file_name)}`;
      const { data, error } = await supabase.storage.from(BUCKETS.deliverables).createSignedUploadUrl(path);
      if (error || !data) return Response.json({ error: "Could not prepare the upload." }, { status: 500 });
      return Response.json({
        path,
        upload_url: data.signedUrl,
        method: "PUT",
        headers: { "Content-Type": "video/mp4" },
      });
    }
    case "submit": {
      const { error } = await supabase.rpc("editor_submit_cut", {
        p_job_id: id,
        p_path: input.path,
        p_alt_path: (input.alt_path ?? null) as string,
        p_notes: input.notes ?? "",
      });
      return error ? fail(error) : Response.json({ ok: true, status: "submitted" });
    }
    case "note": {
      const { error } = await supabase.from("job_messages").insert({ job_id: id, client_id: job.client_id, body: input.body });
      return error ? Response.json({ error: "Could not post the note." }, { status: 409 }) : Response.json({ ok: true });
    }
  }
}
