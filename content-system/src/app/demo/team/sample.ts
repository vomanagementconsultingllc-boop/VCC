import type { BoardVideo } from "@/components/team/video-board";
import type { TodoScript } from "@/lib/team-todo";

/** Made-up videos for the demo, as the database would return them. */
const bright = { name: "Allison Park", business: "Bright Dental" };
const oak = { name: "Marcus Reed", business: "Oak & Iron Fitness" };
const luna = { name: "Sofia Alvarez", business: "Luna Skin Studio" };

// Dates are fixed so the demo always reads the same.
export const DEMO_NOW = new Date("2027-01-06T15:00:00Z");

export const DEMO_SCRIPTS: Array<TodoScript & { client_id: string }> = [
  { id: "v1", client_id: "bright", title: "Nobody tells you this about whitening", stage: "review", footage_requested_at: null, brief: null, client: bright },
  { id: "v2", client_id: "oak", title: "The warm-up everyone skips", stage: "footage_received", footage_requested_at: null, brief: null, client: oak },
  { id: "v3", client_id: "luna", title: "Stop washing your face like this", stage: "scripted", footage_requested_at: null, brief: null, client: luna },
  { id: "v4", client_id: "luna", title: "Three products I would never buy", stage: "scripted", footage_requested_at: null, brief: null, client: luna },
  { id: "v5", client_id: "oak", title: "Why your squat is stuck", stage: "research", footage_requested_at: null, brief: null, client: oak },
  { id: "v6", client_id: "bright", title: "You are probably brushing your teeth wrong", stage: "sent_to_client", footage_requested_at: null, brief: null, client: bright },
  { id: "v7", client_id: "bright", title: "Stop doing this before your check-up", stage: "awaiting_footage", footage_requested_at: null, brief: { due_date: "2027-01-09" }, client: bright },
  { id: "v8", client_id: "oak", title: "What I eat before a 6am session", stage: "awaiting_footage", footage_requested_at: null, brief: { due_date: "2027-01-02" }, client: oak },
  { id: "v9", client_id: "luna", title: "The one question every new client asks", stage: "in_edit", footage_requested_at: null, brief: null, client: luna },
  { id: "v10", client_id: "bright", title: "Three things I would never do as a dentist", stage: "delivered", footage_requested_at: null, brief: null, client: bright },
  { id: "v11", client_id: "bright", title: "Brushing too hard", stage: "posted", footage_requested_at: null, brief: null, client: bright },
];

export const DEMO_CLIENTS = [
  { id: "bright", ...bright },
  { id: "oak", ...oak },
  { id: "luna", ...luna },
];

/** In the demo every video opens the Videos page: there are no real pages behind them. */
export const DEMO_VIDEOS_HREF = "/demo/team/videos";

export function demoBoardVideos(late: (s: TodoScript) => boolean): BoardVideo[] {
  return DEMO_SCRIPTS.map((s) => ({
    id: s.id,
    title: s.title,
    stage: s.stage,
    client: Array.isArray(s.client) ? "" : (s.client?.business ?? ""),
    href: DEMO_VIDEOS_HREF,
    late: late(s),
    dueDate: Array.isArray(s.brief) ? null : (s.brief?.due_date ?? null),
  }));
}
