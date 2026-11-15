"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { missingRequired, readIntake } from "@/lib/intake";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid, text, type ActionState } from "@/lib/forms";

/**
 * Everything a client can do to a script. Each call goes through a database
 * function that checks the script is theirs and in the right stage, so a
 * tampered form cannot touch anyone else's script.
 */
export async function approveScript(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireClient();
  const id = text(formData, "script_id");
  if (!isUuid(id)) return { error: "Unknown script." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_approve_script", { p_script_id: id });
  if (error) return { error: error.code === "23514" ? error.message : "Could not approve. Try again." };
  refresh();
  return { ok: "Approved. Your upload slots are open." };
}

export async function requestChanges(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireClient();
  const id = text(formData, "script_id");
  const comment = text(formData, "comment");
  if (!isUuid(id)) return { error: "Unknown script." };
  if (!comment) return { error: "Tell us what you would like changed." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_request_changes", { p_script_id: id, p_comment: comment });
  if (error) return { error: error.code === "23514" ? error.message : "Could not send that. Try again." };
  refresh();
  return { ok: "Sent. We will rework it and let you know when it is ready." };
}

export async function addClientComment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireClient();
  const id = text(formData, "script_id");
  const body = text(formData, "body");
  if (!isUuid(id)) return { error: "Unknown script." };
  if (!body) return { error: "Write a comment first." };
  const supabase = await createClient();
  const { error } = await supabase.from("script_comments").insert({ script_id: id, client_id: user.clientId, body });
  if (error) return { error: "Could not post that. Try again." };
  refresh();
  return { ok: "Sent to the team." };
}

const PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "linkedin", "other"];

/** The client tells us a delivered video has gone out. */
export async function markPosted(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireClient();
  const id = text(formData, "deliverable_id");
  const platform = text(formData, "platform");
  if (!isUuid(id)) return { error: "Unknown video." };
  if (!PLATFORMS.includes(platform)) return { error: "Choose where you posted it." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_mark_posted", {
    p_deliverable_id: id,
    p_platform: platform,
    p_post_url: text(formData, "post_url"),
  });
  if (error) return { error: error.code === "23514" ? error.message : "Could not save that. Try again." };
  refresh();
  return { ok: "Marked as posted. Nice work." };
}

/** Step 3: the client approves an edit. It is then theirs to download. */
export async function approveVideo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireClient();
  const id = text(formData, "deliverable_id");
  if (!isUuid(id)) return { error: "Unknown video." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_approve_video", { p_deliverable_id: id });
  if (error) return { error: "Could not approve that. Try again." };
  refresh();
  return { ok: "Approved. It is ready to download below." };
}

/** Step 3: the client sends an edit back with what to fix. */
export async function requestFix(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireClient();
  const id = text(formData, "deliverable_id");
  const note = text(formData, "note");
  if (!isUuid(id)) return { error: "Unknown video." };
  if (!note) return { error: "Tell me what to fix." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_request_fix", { p_deliverable_id: id, p_note: note });
  if (error) return { error: error.code === "23514" ? error.message : "Could not send that. Try again." };
  refresh();
  return { ok: "Sent back. I will let you know when the fix is ready." };
}

/** The first-sign-in questionnaire. Saved through a database function that only ever writes the caller's own answers. */
export async function submitIntake(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireClient();
  const answers = readIntake(formData);
  const missing = missingRequired(answers);
  if (missing.length) return { error: `I still need: ${missing.map((f) => f.label.replace(/\?$/, "")).join("; ")}.` };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_intake", { p_answers: answers });
  if (error) return { error: "Could not save your answers. Try again." };
  redirect("/portal");
}
