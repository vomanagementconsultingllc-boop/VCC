import type { Metadata } from "next";
import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, EmptyState } from "@/components/ui";
import { STAGES, type Stage } from "@/lib/labels";

export const metadata: Metadata = { title: "To do" };

/** What each stage asks of the client, if anything. */
const CLIENT_TASK: Partial<Record<Stage, string>> = {
  sent_to_client: "Read and approve your script",
  awaiting_footage: "Record and upload your footage",
  delivered: "Download your video and post it",
};

export default async function PortalHome() {
  const user = await requireClient();
  const supabase = await createClient();
  const { data: scripts } = await supabase
    .from("scripts")
    .select("id, title, stage, updated_at")
    .order("updated_at", { ascending: false });

  const waiting = (scripts ?? []).filter((s) => CLIENT_TASK[s.stage]);
  const inProgress = (scripts ?? []).filter((s) => !CLIENT_TASK[s.stage] && s.stage !== "posted");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-ink">
        {user.fullName ? `Hi ${user.fullName.split(" ")[0]}` : "Welcome"}
      </h1>

      <section aria-labelledby="waiting-heading">
        <h2 id="waiting-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-2">
          Waiting on you
        </h2>
        {waiting.length === 0 ? (
          <EmptyState title="Nothing is waiting on you">
            We will email you as soon as your next script is ready.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {waiting.map((s) => (
              <li key={s.id}>
                <Link
                  href={s.stage === "delivered" ? "/portal/delivered" : `/portal/scripts/${s.id}`}
                  className="flex min-h-20 items-center justify-between gap-3 rounded-xl border border-gold bg-surface p-4"
                >
                  <span>
                    <span className="block font-semibold text-ink">{CLIENT_TASK[s.stage]}</span>
                    <span className="text-sm text-ink-2">{s.title}</span>
                  </span>
                  <span aria-hidden className="text-2xl text-gold">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {inProgress.length > 0 && (
        <section aria-labelledby="progress-heading">
          <h2 id="progress-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-2">
            With us
          </h2>
          <ul className="space-y-3">
            {inProgress.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/portal/scripts/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4"
                >
                  <span className="font-semibold text-ink">{s.title}</span>
                  <Badge tone={STAGES[s.stage].tone}>
                    {s.stage === "footage_received" ? "Footage received" : s.stage === "posted" ? "Posted" : "Being edited"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
