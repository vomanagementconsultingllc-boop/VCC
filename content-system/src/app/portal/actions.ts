"use server";

import { refresh } from "next/cache";
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
