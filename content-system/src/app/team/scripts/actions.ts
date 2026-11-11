"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid, text, type ActionState } from "@/lib/forms";
import { findNeverSay } from "@/lib/voice";

const shotSchema = z.object({
  id: z.string().uuid().optional(),
  instruction: z.string().trim().max(300),
  lines: z.string().max(5000),
  framing: z.string().trim().max(300),
  orientation: z.enum(["portrait", "landscape"]),
  minDuration: z.number().int().min(0).max(600),
  whereToLook: z.string().trim().max(300),
  lightingNotes: z.string().trim().max(300),
});

const scriptSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Give the script a title.").max(200),
  hook: z.string().trim().max(600),
  body: z.string().max(20000),
  format: z.enum(["talking_head", "voiceover_broll", "skit", "listicle", "reaction"]),
  internalNotes: z.string().max(5000),
  styleNotes: z.string().max(5000),
  referenceUrl: z.string().trim().max(500),
  briefNotes: z.string().max(5000),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  shots: z.array(shotSchema).max(30, "A script can have at most 30 shots."),
});

export type ScriptInput = z.infer<typeof scriptSchema>;

export async function createScript(formData: FormData): Promise<void> {
  await requireStaff();
  const clientId = text(formData, "client_id");
  if (!isUuid(clientId)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("scripts")
    .insert({ client_id: clientId, title: "Untitled script" })
    .select("id")
    .single();
  if (data) redirect(`/team/scripts/${data.id}`);
}

/** Save the whole editor: words, shot list, shooting brief and internal notes. */
export async function saveScript(input: ScriptInput): Promise<ActionState> {
  await requireStaff();
  const parsed = scriptSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const s = parsed.data;

  const supabase = await createClient();
  const { data: script } = await supabase.from("scripts").select("id, client_id").eq("id", s.id).maybeSingle();
  if (!script) return { error: "This script no longer exists." };

  const { error: scriptError } = await supabase
    .from("scripts")
    .update({ title: s.title, hook: s.hook, body: s.body, format: s.format })
    .eq("id", s.id);
  if (scriptError) return { error: "Could not save the script. Try again." };

  const [{ error: internalError }, { error: briefError }] = await Promise.all([
    supabase
      .from("script_internal")
      .update({ internal_notes: s.internalNotes, style_notes: s.styleNotes })
      .eq("script_id", s.id),
    supabase
      .from("shooting_briefs")
      .update({ reference_url: s.referenceUrl, notes: s.briefNotes, due_date: s.dueDate })
      .eq("script_id", s.id),
  ]);
  if (internalError || briefError) return { error: "Could not save the notes and brief. Try again." };

  // Shots keep their ids across saves, because uploaded footage points at them.
  const { data: existing } = await supabase.from("shots").select("id").eq("script_id", s.id);
  const existingIds = new Set((existing ?? []).map((row) => row.id));
  const rows = s.shots.map((shot, index) => ({
    id: shot.id && existingIds.has(shot.id) ? shot.id : randomUUID(),
    script_id: s.id,
    client_id: script.client_id,
    shot_number: index + 1,
    instruction: shot.instruction,
    lines: shot.lines,
    framing: shot.framing,
    orientation: shot.orientation,
    min_duration_seconds: shot.minDuration,
    where_to_look: shot.whereToLook,
    lighting_notes: shot.lightingNotes,
  }));
  const keep = new Set(rows.map((r) => r.id));
  const remove = [...existingIds].filter((id) => !keep.has(id));

  if (remove.length) {
    const { error } = await supabase.from("shots").delete().in("id", remove);
    if (error) {
      return { error: "A shot you removed already has footage uploaded. Remove the footage first, or keep the shot." };
    }
  }
  if (rows.length) {
    const { error } = await supabase.from("shots").upsert(rows, { onConflict: "id" });
    if (error) return { error: "Could not save the shot list. Try again." };
  }

  refresh();
  return { ok: "Saved." };
}

export async function sendToClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const id = text(formData, "script_id");
  if (!isUuid(id)) return { error: "Unknown script." };

  const supabase = await createClient();
  const { data: script } = await supabase
    .from("scripts")
    .select("id, client_id, hook, body, stage")
    .eq("id", id)
    .maybeSingle();
  if (!script) return { error: "This script no longer exists." };
  if (script.stage !== "scripted" && script.stage !== "research") {
    return { error: "This script has already been sent." };
  }

  const { data: voice } = await supabase
    .from("voice_profiles")
    .select("phrases_never")
    .eq("client_id", script.client_id)
    .maybeSingle();
  const hits = findNeverSay(`${script.hook}\n${script.body}`, voice?.phrases_never ?? []);
  if (hits.length) {
    return { error: `The script uses words this client never says: ${hits.join(", ")}. Reword it, then send.` };
  }

  const { error } = await supabase.from("scripts").update({ stage: "sent_to_client" }).eq("id", id);
  if (error) {
    // The database explains itself (no shots, empty script, unreviewed AI draft).
    return { error: error.code === "23514" ? error.message : "Could not send the script. Try again." };
  }
  refresh();
  return { ok: "Sent. The client can now see it in their portal." };
}

/** Take a sent script back to draft, for example to fix a typo before they approve. */
export async function pullBackScript(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const id = text(formData, "script_id");
  if (!isUuid(id)) return { error: "Unknown script." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scripts")
    .update({ stage: "scripted" })
    .eq("id", id)
    .eq("stage", "sent_to_client")
    .select("id");
  if (error || !data?.length) return { error: "Only a script waiting on the client can be pulled back." };
  refresh();
  return { ok: "Pulled back to draft. The client no longer sees it." };
}

export async function addTeamComment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const id = text(formData, "script_id");
  const body = text(formData, "body");
  if (!isUuid(id)) return { error: "Unknown script." };
  if (!body) return { error: "Write a comment first." };
  const supabase = await createClient();
  const { data: script } = await supabase.from("scripts").select("client_id").eq("id", id).maybeSingle();
  if (!script) return { error: "This script no longer exists." };
  const { error } = await supabase
    .from("script_comments")
    .insert({ script_id: id, client_id: script.client_id, body });
  if (error) return { error: "Could not post the comment." };
  refresh();
  return { ok: "Posted. The client can see this." };
}

export async function deleteScript(formData: FormData): Promise<void> {
  await requireStaff();
  const id = text(formData, "script_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  const { data: script } = await supabase.from("scripts").select("client_id, stage").eq("id", id).maybeSingle();
  if (!script) return;
  // Only drafts can be deleted from here; anything further along has footage or edits attached.
  if (script.stage !== "scripted" && script.stage !== "research") return;
  await supabase.from("scripts").delete().eq("id", id);
  redirect(`/team/clients/${script.client_id}/scripts`);
}
