"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { text, type ActionState } from "@/lib/forms";

const ALLOWED_TYPES = new Set<EmailOtpType>(["email", "magiclink", "invite"]);

/** Exchange the one-time token from the email for a session. */
export async function confirmSignIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const tokenHash = text(formData, "token_hash");
  const type = text(formData, "type") as EmailOtpType;
  if (!tokenHash || !ALLOWED_TYPES.has(type)) {
    return { error: "This sign-in link is not valid. Ask for a new one." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return { error: "This link has expired or was already used. Ask for a new one from the sign-in page." };
  }
  redirect("/");
}
