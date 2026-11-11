import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Role = Database["public"]["Enums"]["app_role"];

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  clientId: string | null;
};

/**
 * The signed-in user and their role, verified with the auth server (not just
 * read from the cookie). Memoised per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, client_id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    clientId: profile.client_id,
  };
});

export function homeFor(role: Role): string {
  switch (role) {
    case "admin":
    case "team":
      return "/team";
    case "editor":
      return "/editor";
    case "client":
      return "/portal";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Use at the top of every page and Server Action. Wrong role goes home. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export const requireStaff = () => requireRole("admin", "team");
export const requireAdmin = () => requireRole("admin");
export const requireEditor = () => requireRole("editor");

export async function requireClient(): Promise<SessionUser & { clientId: string }> {
  const user = await requireRole("client");
  if (!user.clientId) redirect("/login");
  return user as SessionUser & { clientId: string };
}
