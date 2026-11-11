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

export type Stage = Enums["script_stage"];
export type VideoFormat = Enums["video_format"];

/** Pipeline order. "approved" is a moment, not a resting place: approval moves a script straight to awaiting_footage. */
export const STAGE_ORDER: Stage[] = [
  "research",
  "scripted",
  "sent_to_client",
  "approved",
  "awaiting_footage",
  "footage_received",
  "in_edit",
  "review",
  "delivered",
  "posted",
];

export const STAGES: Record<Stage, { label: string; tone: Tone; waitingOn: "team" | "client" | "editor" | "nobody" }> = {
  research: { label: "Research", tone: "neutral", waitingOn: "team" },
  scripted: { label: "Scripted", tone: "info", waitingOn: "team" },
  sent_to_client: { label: "Sent to client", tone: "warning", waitingOn: "client" },
  approved: { label: "Approved", tone: "success", waitingOn: "client" },
  awaiting_footage: { label: "Awaiting footage", tone: "warning", waitingOn: "client" },
  footage_received: { label: "Footage received", tone: "info", waitingOn: "team" },
  in_edit: { label: "In edit", tone: "gold", waitingOn: "editor" },
  review: { label: "Review", tone: "info", waitingOn: "team" },
  delivered: { label: "Delivered", tone: "success", waitingOn: "client" },
  posted: { label: "Posted and tracked", tone: "success", waitingOn: "nobody" },
};

/** Columns on the internal board. */
export const BOARD_STAGES: Stage[] = STAGE_ORDER.filter((s) => s !== "approved");

export function stageIndex(stage: Stage): number {
  return STAGE_ORDER.indexOf(stage);
}

export const FORMATS: Record<VideoFormat, string> = {
  talking_head: "Talking head",
  voiceover_broll: "Voiceover with b-roll",
  skit: "Skit",
  listicle: "Listicle",
  reaction: "Reaction",
};

/** The simple checklist a client sees for each script. */
export const CLIENT_STEPS: Array<{ label: string; doneFrom: Stage }> = [
  { label: "Script ready", doneFrom: "sent_to_client" },
  { label: "You approved it", doneFrom: "awaiting_footage" },
  { label: "Footage uploaded", doneFrom: "footage_received" },
  { label: "Being edited", doneFrom: "in_edit" },
  { label: "Video delivered", doneFrom: "delivered" },
  { label: "Posted", doneFrom: "posted" },
];
