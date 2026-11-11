import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Relative redirect: stays on whatever host the visitor used.
  return new Response(null, { status: 303, headers: { Location: "/login" } });
}
