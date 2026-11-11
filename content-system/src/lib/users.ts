import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role, SessionUser } from "@/lib/auth";

/**
 * Account provisioning. There is no self sign-up: an account exists only
 * because staff created it here. Uses the service role, so every caller must
 * have checked the inviter's role first.
 */
export async function inviteUser(
  inviter: SessionUser,
  input: { email: string; fullName: string; role: Role; clientId: string | null },
): Promise<{ error?: string; userId?: string }> {
  // Only admins hand out internal roles. Team members may invite client logins.
  if (input.role !== "client" && inviter.role !== "admin") {
    return { error: "Only an admin can add team members or editors." };
  }
  if (inviter.role !== "admin" && inviter.role !== "team") {
    return { error: "Not allowed." };
  }
  if ((input.role === "client") !== Boolean(input.clientId)) {
    return { error: "A client login must belong to a client, and only a client login can." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.fullName },
  });
  if (error || !data.user) {
    const exists = error?.message?.toLowerCase().includes("already");
    return { error: exists ? "That email already has an account." : "Could not send the invite. Try again." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    role: input.role,
    client_id: input.clientId,
    full_name: input.fullName,
    email: input.email,
  });
  if (profileError) {
    // Never leave an auth user without a profile: it could sign in with no role.
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "Could not create the account. Try again." };
  }

  await admin.from("audit_log").insert({
    actor_id: inviter.id,
    actor_role: inviter.role,
    client_id: input.clientId,
    table_name: "profiles",
    record_id: data.user.id,
    action: "invited",
    details: { role: input.role },
  });
  return { userId: data.user.id };
}

export async function removeUser(remover: SessionUser, userId: string): Promise<{ error?: string }> {
  if (remover.id === userId) return { error: "You cannot remove your own account." };
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role, client_id").eq("id", userId).maybeSingle();
  if (!target) return { error: "That account no longer exists." };
  if (target.role !== "client" && remover.role !== "admin") {
    return { error: "Only an admin can remove team members or editors." };
  }
  if (remover.role !== "admin" && remover.role !== "team") return { error: "Not allowed." };

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: "Could not remove the account. Try again." };

  await admin.from("audit_log").insert({
    actor_id: remover.id,
    actor_role: remover.role,
    client_id: target.client_id,
    table_name: "profiles",
    record_id: userId,
    action: "removed",
    details: { role: target.role },
  });
  return {};
}
