import "server-only";
import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * For the three step pages: the signed-in client, once they have answered
 * the questionnaire. A client who has not is sent to it first, because the
 * research and the shooting directions are built from those answers.
 */
export async function requireOnboardedClient() {
  const user = await requireClient();
  const supabase = await createClient();
  const { data } = await supabase.from("client_intake").select("completed_at").maybeSingle();
  if (!data?.completed_at) redirect("/portal/welcome");
  return { user, supabase };
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function weekLabel(weekOf: string | null): string {
  if (!weekOf) return "";
  return `Week of ${new Date(`${weekOf}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
