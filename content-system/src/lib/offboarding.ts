import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS } from "@/lib/storage";
import type { SessionUser } from "@/lib/auth";

/**
 * Per-client export and delete, so offboarding is one button. Admin only:
 * callers must have checked the role. Uses the service role because it has
 * to reach every table and every file for exactly one client.
 */
const CLIENT_TABLES = [
  "voice_profiles",
  "voice_corrections",
  "client_notes",
  "client_financials",
  "client_intake",
  "scripts",
  "script_internal",
  "shots",
  "shooting_briefs",
  "script_comments",
  "footage_uploads",
  "edit_jobs",
  "edit_job_costs",
  "job_messages",
  "deliverables",
  "performance_logs",
  "broll_requests",
  "broll_submissions",
  "hook_uses",
  "ai_calls",
  "notifications",
  "audit_log",
] as const;

type Admin = ReturnType<typeof createAdminClient>;

async function listFiles(admin: Admin, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (!data?.length) break;
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null) files.push(...(await listFiles(admin, bucket, path)));
      else files.push(path);
    }
    if (data.length < 1000) break;
  }
  return files;
}

/** Everything held about one client, as one JSON document (file paths, not the videos themselves). */
export async function exportClient(clientId: string): Promise<Record<string, unknown> | null> {
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!client) return null;
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), client };
  const { data: logins } = await admin.from("profiles").select("id, email, full_name, created_at").eq("client_id", clientId);
  out.logins = logins ?? [];
  for (const table of CLIENT_TABLES) {
    const { data } = await admin.from(table).select("*").eq("client_id", clientId);
    out[table] = data ?? [];
  }
  const files: Record<string, string[]> = {};
  for (const bucket of Object.values(BUCKETS)) files[bucket] = await listFiles(admin, bucket, clientId);
  out.files = files;
  return out;
}

/** Delete a client: their files, their logins, and every row about them. Leaves one audit entry. */
export async function deleteClient(actor: SessionUser, clientId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id, name, business").eq("id", clientId).maybeSingle();
  if (!client) return { error: "That client no longer exists." };

  for (const bucket of Object.values(BUCKETS)) {
    const files = await listFiles(admin, bucket, clientId);
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(files.slice(i, i + 100));
      if (error) return { error: "Could not delete all of the client's files. Nothing else was removed. Try again." };
    }
  }
  const { data: logins } = await admin.from("profiles").select("id").eq("client_id", clientId);
  for (const login of logins ?? []) await admin.auth.admin.deleteUser(login.id);

  const { error } = await admin.from("clients").delete().eq("id", clientId);
  if (error) return { error: "The files were deleted but the client record could not be. Try again." };

  // The log of what happened to the client goes with them; what stays is the fact of the deletion.
  await admin.from("audit_log").delete().eq("client_id", clientId);
  await admin.from("audit_log").insert({
    actor_id: actor.id,
    actor_role: actor.role,
    client_id: clientId,
    table_name: "clients",
    record_id: clientId,
    action: "offboarded_and_deleted",
    details: {},
  });
  return {};
}
