import type { Database } from "@/lib/database.types";
import type { Tone } from "@/components/ui";

type Enums = Database["public"]["Enums"];

export const CLIENT_STATUS: Record<Enums["client_status"], { label: string; tone: Tone }> = {
  onboarding: { label: "Onboarding", tone: "info" },
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  offboarded: { label: "Offboarded", tone: "neutral" },
};

export const ROLE_LABEL: Record<Enums["app_role"], string> = {
  admin: "Admin",
  team: "Team member",
  editor: "Editor",
  client: "Client",
};

export const PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "linkedin"] as const;

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
