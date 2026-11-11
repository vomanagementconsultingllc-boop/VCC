"use server";

import { createClient } from "@/lib/supabase/server";
import { isEmail, text, type ActionState } from "@/lib/forms";

/**
 * Email a one-time sign-in link. There are no passwords and no self sign-up:
 * only people the team has invited have accounts. The reply is the same
 * whether or not the address has an account, so this cannot be used to find
 * out who is a client.
 */
export async function requestSignInLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email").toLowerCase();
  if (!isEmail(email)) {
    return { error: "Enter the email address your account was set up with." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error && error.status === 429) {
    return { error: "A link was sent a moment ago. Check your inbox, or try again in a minute." };
  }
  // Any other error (including "no such user") is deliberately not surfaced.
  return { ok: "If that address has an account, a sign-in link is on its way. It can take a minute to arrive." };
}
