"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inviteUser, removeUser } from "@/lib/users";
import { dollarsToCents, isEmail, isUuid, list, tags, text, type ActionState } from "@/lib/forms";
import { INTAKE_FIELDS } from "@/lib/onboarding";
import type { Database } from "@/lib/database.types";

type ClientStatus = Database["public"]["Enums"]["client_status"];
const STATUSES: ClientStatus[] = ["onboarding", "active", "paused", "offboarded"];

function clientFields(formData: FormData) {
  const status = text(formData, "status") as ClientStatus;
  const assigned = text(formData, "assigned_team_member");
  return {
    name: text(formData, "name"),
    business: text(formData, "business"),
    niche_tags: tags(formData, "niche_tags"),
    platforms: formData.getAll("platforms").map(String),
    posting_cadence: text(formData, "posting_cadence"),
    posting_days: formData.getAll("posting_days").map(String),
    login_contact: text(formData, "login_contact"),
    status: STATUSES.includes(status) ? status : ("onboarding" as ClientStatus),
    assigned_team_member: isUuid(assigned) ? assigned : null,
  };
}

export async function createClientRecord(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const fields = clientFields(formData);
  if (!fields.name) return { error: "Give the client a name." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").insert(fields).select("id").single();
  if (error || !data) return { error: "Could not create the client. Try again." };

  // Every client gets an (empty) voice profile from day one.
  await supabase.from("voice_profiles").insert({ client_id: data.id });
  redirect(`/team/clients/${data.id}`);
}

export async function updateClientRecord(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const id = text(formData, "client_id");
  if (!isUuid(id)) return { error: "Unknown client." };
  const fields = clientFields(formData);
  if (!fields.name) return { error: "Give the client a name." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(fields).eq("id", id);
  if (error) return { error: "Could not save. Try again." };
  refresh();
  return { ok: "Saved." };
}

export async function saveVoiceProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const clientId = text(formData, "client_id");
  if (!isUuid(clientId)) return { error: "Unknown client." };

  const intake: Record<string, string> = {};
  for (const field of INTAKE_FIELDS) {
    const value = text(formData, `intake_${field.key}`);
    if (value) intake[field.key] = value;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("voice_profiles").upsert({
    client_id: clientId,
    interview_transcript: text(formData, "interview_transcript"),
    interview_source: text(formData, "interview_source"),
    phrases_use: list(formData, "phrases_use"),
    phrases_never: list(formData, "phrases_never"),
    tone_notes: text(formData, "tone_notes"),
    topics_avoid: list(formData, "topics_avoid"),
    example_posts: text(formData, "example_posts")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    offer: text(formData, "offer"),
    audience: text(formData, "audience"),
    summary: text(formData, "summary"),
    intake_answers: intake,
  });
  if (error) return { error: "Could not save the voice profile. Try again." };
  refresh();
  return { ok: "Voice profile saved." };
}

export async function addClientNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const clientId = text(formData, "client_id");
  const body = text(formData, "body");
  if (!isUuid(clientId)) return { error: "Unknown client." };
  if (!body) return { error: "Write a note first." };

  const supabase = await createClient();
  const { error } = await supabase.from("client_notes").insert({ client_id: clientId, body });
  if (error) return { error: "Could not save the note." };
  refresh();
  return { ok: "Note added." };
}

export async function resolveCorrection(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const id = text(formData, "correction_id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase
    .from("voice_corrections")
    .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq("id", id);
  refresh();
}

export async function inviteClientLogin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const clientId = text(formData, "client_id");
  const email = text(formData, "email").toLowerCase();
  const fullName = text(formData, "full_name");
  if (!isUuid(clientId)) return { error: "Unknown client." };
  if (!isEmail(email)) return { error: "Enter a valid email address." };

  const result = await inviteUser(user, { email, fullName, role: "client", clientId });
  if (result.error) return { error: result.error };
  refresh();
  return { ok: `Invite sent to ${email}.` };
}

export async function removeClientLogin(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const userId = text(formData, "user_id");
  if (!isUuid(userId)) return;
  await removeUser(user, userId);
  refresh();
}

export async function saveFinancials(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const clientId = text(formData, "client_id");
  const cents = dollarsToCents(text(formData, "price_per_video"));
  if (!isUuid(clientId)) return { error: "Unknown client." };
  if (cents == null) return { error: "Enter a price in dollars, for example 150." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_financials")
    .upsert({ client_id: clientId, price_per_video_cents: cents, notes: text(formData, "notes") });
  if (error) return { error: "Could not save." };
  refresh();
  return { ok: "Saved." };
}
