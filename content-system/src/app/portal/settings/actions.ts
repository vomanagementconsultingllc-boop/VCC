"use server";

import { refresh } from "next/cache";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_NOTIFICATIONS } from "@/lib/notification-prefs";
import { text, type ActionState } from "@/lib/forms";

export async function sendVoiceCorrection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireClient();
  const body = text(formData, "body");
  if (!body) return { error: "Tell us what we got wrong first." };

  const supabase = await createClient();
  // client_id comes from the session, never from the form.
  const { error } = await supabase.from("voice_corrections").insert({ client_id: user.clientId, body });
  if (error) return { error: "Could not send that. Try again." };
  refresh();
  return { ok: "Thanks. We will update how we write for you." };
}

export async function savePreferences(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireClient();
  const prefs: Record<string, boolean> = {};
  for (const n of CLIENT_NOTIFICATIONS) {
    prefs[n.key] = formData.get(n.key) === "on";
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: text(formData, "full_name"), notification_prefs: prefs })
    .eq("id", user.id);
  if (error) return { error: "Could not save. Try again." };
  refresh();
  return { ok: "Saved." };
}
