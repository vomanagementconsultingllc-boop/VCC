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

/** The three steps, the same words the client sees. The team's Videos page is grouped by them. */
export type StepKey = "plan" | "shoot" | "finish";
export const STEPS: Array<{ key: StepKey; number: number; label: string; about: string }> = [
  { key: "plan", number: 1, label: "Plan", about: "Scripts being written, and scripts the client is reading." },
  { key: "shoot", number: 2, label: "Shoot", about: "Approved scripts the client is filming." },
  { key: "finish", number: 3, label: "Finish", about: "Footage is in: editing, checking, and handing over." },
];

export const STAGE_STEP: Record<Stage, StepKey> = {
  research: "plan",
  scripted: "plan",
  sent_to_client: "plan",
  approved: "shoot",
  awaiting_footage: "shoot",
  footage_received: "finish",
  in_edit: "finish",
  review: "finish",
  delivered: "finish",
  posted: "finish",
};

/** What is happening to a video right now, in plain words, for the team. */
export const STAGE_NOW: Record<Stage, string> = {
  research: "Write the script",
  scripted: "Check the script and send it to the client",
  sent_to_client: "The client is reading the script",
  approved: "The client is filming",
  awaiting_footage: "The client is filming",
  footage_received: "Footage is in. Pick an editor",
  in_edit: "The editor is working on it",
  review: "The edit is back. Watch it and approve it",
  delivered: "The client is checking the finished video",
  posted: "Posted",
};

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

export type JobStatus = Enums["job_status"];

export const JOB_STATUS: Record<JobStatus, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "neutral" },
  in_progress: { label: "In progress", tone: "gold" },
  submitted: { label: "Needs review", tone: "warning" },
  revision: { label: "Revision requested", tone: "danger" },
  done: { label: "Done", tone: "success" },
};

export function isOverdue(dueDate: string | null | undefined): boolean {
  return dueDate != null && dueDate < new Date().toISOString().slice(0, 10);
}

/** A joined row can arrive as one object or a list of one, depending on how the relation is detected. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
