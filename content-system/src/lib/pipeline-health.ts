import { one, type Stage } from "@/lib/labels";

export type Health = { waiting: number; overdue: number; editing: number };

type ScriptRow = {
  client_id: string;
  stage: Stage;
  footage_requested_at: string | null;
  brief: { due_date: string | null } | Array<{ due_date: string | null }> | null;
};

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

/**
 * Footage is late once it is past the date on the brief, or, with no date
 * set, six days after approval (when the second reminder goes out).
 */
export function footageIsLate(
  s: Pick<ScriptRow, "stage" | "footage_requested_at" | "brief">,
  now: Date,
): boolean {
  if (s.stage !== "awaiting_footage") return false;
  const due = one(s.brief)?.due_date ?? null;
  if (due) return due < now.toISOString().slice(0, 10);
  const sixDaysAgo = new Date(now.getTime() - SIX_DAYS_MS).toISOString();
  return s.footage_requested_at != null && s.footage_requested_at < sixDaysAgo;
}

/**
 * Pipeline health per client: scripts waiting on the client, footage that is
 * late, and edits in the queue.
 */
export function pipelineHealth(scripts: ScriptRow[], now: Date): Map<string, Health> {
  const health = new Map<string, Health>();
  for (const s of scripts) {
    const h = health.get(s.client_id) ?? { waiting: 0, overdue: 0, editing: 0 };
    if (s.stage === "sent_to_client") h.waiting += 1;
    if (footageIsLate(s, now)) h.overdue += 1;
    if (s.stage === "footage_received" || s.stage === "in_edit" || s.stage === "review") h.editing += 1;
    health.set(s.client_id, h);
  }
  return health;
}
