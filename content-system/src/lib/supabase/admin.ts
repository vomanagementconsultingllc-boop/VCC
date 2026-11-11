import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv, requireEnv } from "@/lib/env";

/**
 * Service-role client. It BYPASSES row level security, so it is only for
 * work no signed-in user is allowed to do directly: creating users, deleting
 * a client's files on offboarding, and background jobs with no user at all.
 *
 * Rules for callers:
 *   - check the caller's role first (requireAdmin / requireStaff)
 *   - never return its results to a user without filtering by their client_id
 *   - never import this from a Client Component ("server-only" enforces it)
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.supabaseUrl, requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
