"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inviteUser, removeUser } from "@/lib/users";
import { dollarsToCents, intOrNull, isEmail, isUuid, text, type ActionState } from "@/lib/forms";
import type { Role } from "@/lib/auth";

const INTERNAL_ROLES: Role[] = ["admin", "team", "editor"];

export async function inviteInternalUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const email = text(formData, "email").toLowerCase();
  const role = text(formData, "role") as Role;
  if (!isEmail(email)) return { error: "Enter a valid email address." };
  if (!INTERNAL_ROLES.includes(role)) return { error: "Pick a role." };

  const result = await inviteUser(user, { email, fullName: text(formData, "full_name"), role, clientId: null });
  if (result.error) return { error: result.error };
  refresh();
  return { ok: `Invite sent to ${email}.` };
}

export async function removeInternalUser(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const userId = text(formData, "user_id");
  if (!isUuid(userId)) return;
  await removeUser(user, userId);
  refresh();
}

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const allowance = intOrNull(formData, "revision_allowance");
  const cost = dollarsToCents(text(formData, "default_edit_cost"));
  if (allowance != null && allowance < 0) return { error: "Revision allowance cannot be negative." };
  if (cost == null) return { error: "Enter the default edit cost in dollars, for example 20." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({ revision_allowance: allowance, default_edit_cost_cents: cost })
    .eq("id", true);
  if (error) return { error: "Could not save settings." };
  refresh();
  return { ok: "Settings saved." };
}
