import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Use variables already in the environment.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

if (!url || !publishableKey || !secretKey) {
  throw new Error("API tests need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY.");
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url) && process.env.ALLOW_REMOTE_API_TESTS !== "1") {
  // These tests create and delete users and clients. Keep them off real projects.
  throw new Error(`Refusing to run API tests against ${url}. They are meant for a local Supabase stack.`);
}

export type Api = SupabaseClient<Database>;

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

/** Service role: bypasses RLS. Only used to set up and tear down fixtures. */
export const service: Api = createClient<Database>(url, secretKey, noSession);

/** A signed-out visitor holding only the publishable key. */
export function anonymous(): Api {
  return createClient<Database>(url, publishableKey, noSession);
}

/**
 * Sign in the way a real person does: a one-time emailed link, exchanged for
 * a session. Returns a client that acts as that user.
 */
export async function signInAs(email: string): Promise<Api> {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    throw new Error(`could not create a sign-in link for ${email}: ${error?.message}`);
  }
  const client = createClient<Database>(url, publishableKey, noSession);
  const { error: verifyError } = await client.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) throw new Error(`could not sign in as ${email}: ${verifyError.message}`);
  return client;
}

export type World = Awaited<ReturnType<typeof createWorld>>;

/** Two clients and one user per role, created through the real auth API. */
export async function createWorld() {
  const tag = randomUUID().slice(0, 8);
  const email = (name: string) => `${name}-${tag}@example.test`;

  async function makeUser(name: string): Promise<string> {
    const { data, error } = await service.auth.admin.createUser({ email: email(name), email_confirm: true });
    if (error || !data.user) throw new Error(`createUser ${name}: ${error?.message}`);
    return data.user.id;
  }

  const { data: clients, error: clientError } = await service
    .from("clients")
    .insert([
      { name: "Client A", business: `A Bakery ${tag}`, niche_tags: ["bakery"], status: "active" },
      { name: "Client B", business: `B Plumbing ${tag}`, niche_tags: ["plumbing"], status: "active" },
    ])
    .select("id, name");
  if (clientError || !clients) throw new Error(`insert clients: ${clientError?.message}`);
  const clientA = clients.find((c) => c.name === "Client A")!.id;
  const clientB = clients.find((c) => c.name === "Client B")!.id;

  const ids = {
    admin: await makeUser("admin"),
    team: await makeUser("team"),
    editor: await makeUser("editor"),
    otherEditor: await makeUser("other-editor"),
    userA: await makeUser("client-a"),
    userB: await makeUser("client-b"),
  };

  const { error: profileError } = await service.from("profiles").insert([
    { id: ids.admin, role: "admin", email: email("admin"), full_name: "Admin" },
    { id: ids.team, role: "team", email: email("team"), full_name: "Team VA" },
    { id: ids.editor, role: "editor", email: email("editor"), full_name: "Editor One" },
    { id: ids.otherEditor, role: "editor", email: email("other-editor"), full_name: "Editor Two" },
    { id: ids.userA, role: "client", client_id: clientA, email: email("client-a"), full_name: "A Owner" },
    { id: ids.userB, role: "client", client_id: clientB, email: email("client-b"), full_name: "B Owner" },
  ]);
  if (profileError) throw new Error(`insert profiles: ${profileError.message}`);

  for (const [clientId, label] of [[clientA, "A"], [clientB, "B"]] as const) {
    const { error } = await service.from("voice_profiles").insert({
      client_id: clientId,
      interview_transcript: `SECRET transcript ${label}`,
      phrases_use: [`phrase ${label}`],
      tone_notes: `internal tone notes ${label}`,
      summary: `summary ${label}`,
    });
    if (error) throw new Error(`insert voice profile: ${error.message}`);
    await service.from("client_notes").insert({ client_id: clientId, body: `internal note ${label}`, created_by: null });
    await service.from("client_financials").insert({ client_id: clientId, price_per_video_cents: 15000 });
    await service.from("voice_corrections").insert({ client_id: clientId, body: `correction ${label}`, created_by: null });
  }

  return {
    tag,
    email,
    clientA,
    clientB,
    ...ids,
    sessions: {
      admin: await signInAs(email("admin")),
      team: await signInAs(email("team")),
      editor: await signInAs(email("editor")),
      otherEditor: await signInAs(email("other-editor")),
      a: await signInAs(email("client-a")),
      b: await signInAs(email("client-b")),
    },
  };
}

/** A script for client A or B that is approved and waiting for footage, with two shots. */
export async function addShoot(world: World, which: "A" | "B") {
  const clientId = which === "A" ? world.clientA : world.clientB;
  const { data: script, error } = await service
    .from("scripts")
    .insert({ client_id: clientId, title: `Shoot ${which}`, body: "words to say", created_by: null })
    .select("id")
    .single();
  if (error || !script) throw new Error(`insert script: ${error?.message}`);
  const { data: shots, error: shotError } = await service
    .from("shots")
    .insert([
      { script_id: script.id, client_id: clientId, shot_number: 1, instruction: "Talk to camera", min_duration_seconds: 5 },
      { script_id: script.id, client_id: clientId, shot_number: 2, instruction: "Show the product", min_duration_seconds: 5 },
    ])
    .select("id, shot_number")
    .order("shot_number");
  if (shotError || !shots) throw new Error(`insert shots: ${shotError?.message}`);
  for (const stage of ["sent_to_client", "awaiting_footage"] as const) {
    const { error: stageError } = await service.from("scripts").update({ stage }).eq("id", script.id);
    if (stageError) throw new Error(`move script to ${stage}: ${stageError.message}`);
  }
  return { scriptId: script.id, shot1: shots[0].id, shot2: shots[1].id, clientId };
}

export async function destroyWorld(world: World) {
  const clientIds = [world.clientA, world.clientB];
  const userIds = [world.admin, world.team, world.editor, world.otherEditor, world.userA, world.userB];
  for (const bucket of ["footage", "deliverables"]) {
    for (const clientId of clientIds) {
      await removeFolder(bucket, clientId);
    }
  }
  await service.from("clients").delete().in("id", clientIds);
  for (const id of userIds) {
    await service.auth.admin.deleteUser(id);
  }
  await service.from("audit_log").delete().in("client_id", clientIds);
  await service.from("audit_log").delete().in("actor_id", userIds);
}

/** Recursively delete everything under a storage folder. */
async function removeFolder(bucket: string, prefix: string) {
  const { data } = await service.storage.from(bucket).list(prefix, { limit: 1000 });
  if (!data?.length) return;
  const files: string[] = [];
  for (const entry of data) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id === null) await removeFolder(bucket, path);
    else files.push(path);
  }
  if (files.length) await service.storage.from(bucket).remove(files);
}
