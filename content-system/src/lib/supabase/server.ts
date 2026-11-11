import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Supabase client for the signed-in user. Every query made through it runs
 * as that user, so row level security decides what comes back. This is the
 * client almost all server code should use.
 */
export async function createClient() {
  // Everything behind this client is per-user and must never be prerendered
  // or cached. Waiting for the request also keeps the auth library's clock
  // reads out of Next's prerender pass.
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session cookie, so this is safe to ignore.
        }
      },
    },
  });
}
