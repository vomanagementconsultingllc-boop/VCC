import { one, type Stage } from "@/lib/labels";
import { footageIsLate } from "@/lib/pipeline-health";

/**
 * The team's to-do list: every video that is waiting on the team rather than
 * on the client or an editor, grouped by the one thing to do about it. This
 * is what the team's home page opens on.
 */
export type TodoKind = "watch" | "assign" | "send" | "write" | "late";
export type TodoItem = { id: string; title: string; client: string; href: string };
export type TodoGroup = { kind: TodoKind; label: string; hint: string; items: TodoItem[] };

type ClientName = { name: string; business: string };
export type TodoScript = {
  id: string;
  title: string;
  stage: Stage;
  footage_requested_at: string | null;
  brief: { due_date: string | null } | Array<{ due_date: string | null }> | null;
  client: ClientName | ClientName[] | null;
};

// In the order to deal with them: an editor or a client is waiting on the first ones.
const GROUPS: Array<Omit<TodoGroup, "items">> = [
  { kind: "watch", label: "Watch the edit", hint: "An editor sent a video back. Approve it or ask for changes." },
  { kind: "assign", label: "Pick an editor", hint: "The client's footage is in and passed its checks." },
  { kind: "send", label: "Check the script and send it", hint: "Written, but the client has not seen it yet." },
  { kind: "write", label: "Write the script", hint: "Planned for this week, with no script yet." },
  { kind: "late", label: "Footage is late", hint: "The client has not filmed by their date. Give them a nudge." },
];

const KIND_BY_STAGE: Partial<Record<Stage, TodoKind>> = {
  review: "watch",
  footage_received: "assign",
  scripted: "send",
  research: "write",
};

export function teamTodo(
  scripts: TodoScript[],
  /** Edit jobs whose cut is waiting to be watched, so "watch" can link straight to it. */
  submittedJobs: Array<{ id: string; script_id: string }>,
  now: Date,
): TodoGroup[] {
  const jobByScript = new Map(submittedJobs.map((j) => [j.script_id, j.id]));
  const items = new Map<TodoKind, TodoItem[]>();
  for (const s of scripts) {
    const kind = footageIsLate(s, now) ? "late" : KIND_BY_STAGE[s.stage];
    if (!kind) continue;
    const client = one(s.client);
    const jobId = jobByScript.get(s.id);
    const href =
      kind === "watch" && jobId ? `/team/jobs/${jobId}` : kind === "assign" ? "/team/jobs" : `/team/scripts/${s.id}`;
    items.set(kind, [
      ...(items.get(kind) ?? []),
      { id: s.id, title: s.title, client: client?.business || client?.name || "", href },
    ]);
  }
  return GROUPS.flatMap((g) => (items.has(g.kind) ? [{ ...g, items: items.get(g.kind) ?? [] }] : []));
}
