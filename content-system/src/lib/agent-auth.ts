import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Access keys for editor seats. A key lets an automated editor (a Claude
 * session) do exactly what a human editor can do in the app, and nothing
 * more: the key is exchanged for a real session as that editor, so every
 * query it makes goes through the same row level security.
 */
export const KEY_PREFIX = "vcc_ed_";

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** New key. Only the hash is stored; the caller shows the key once. */
export function generateKey(): { key: string; hash: string; prefix: string } {
  const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, hash: hashKey(key), prefix: key.slice(0, KEY_PREFIX.length + 6) };
}

export type EditorSession = { supabase: SupabaseClient<Database>; editorId: string };

function unauthorized(): Response {
  return Response.json({ error: "Missing or invalid access key." }, { status: 401 });
}

export async function editorFromRequest(request: Request): Promise<EditorSession | Response> {
  const header = request.headers.get("authorization") ?? "";
  const key = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!key.startsWith(KEY_PREFIX) || key.length < 40) return unauthorized();

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("editor_access_keys")
    .select("id, editor_id, revoked_at")
    .eq("key_hash", hashKey(key))
    .maybeSingle();
  if (!row || row.revoked_at) return unauthorized();

  const { data: editor } = await admin.from("profiles").select("id, email, role").eq("id", row.editor_id).maybeSingle();
  if (!editor || editor.role !== "editor") return unauthorized();

  // Become that editor for real. From here on nothing uses the service role.
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: editor.email });
  const tokenHash = link?.properties?.hashed_token;
  if (error || !tokenHash) return Response.json({ error: "Could not start a session." }, { status: 500 });

  const supabase = createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  if (verifyError) return Response.json({ error: "Could not start a session." }, { status: 500 });

  await admin.from("editor_access_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  return { supabase, editorId: editor.id };
}
