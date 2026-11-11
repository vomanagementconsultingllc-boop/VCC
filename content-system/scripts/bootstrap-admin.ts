/**
 * Create the first admin account. Run once per environment:
 *
 *   npm run bootstrap-admin -- you@example.com "Your Name"
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local.
 * The account has no password; sign in from /login with an emailed link.
 */
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to variables already in the environment.
}

async function main() {
  const [email, ...nameParts] = process.argv.slice(2);
  const fullName = nameParts.join(" ") || "Admin";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage: npm run bootstrap-admin -- you@example.com "Your Name"');
    process.exit(1);
  }
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email: email.toLowerCase(),
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    console.error(`Could not create the user: ${error?.message ?? "unknown error"}`);
    process.exit(1);
  }
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    role: "admin",
    client_id: null,
    full_name: fullName,
    email: email.toLowerCase(),
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    console.error(`Could not create the profile: ${profileError.message}`);
    process.exit(1);
  }
  console.log(`Admin created for ${email}. Sign in at /login with an emailed link.`);
}

main();
