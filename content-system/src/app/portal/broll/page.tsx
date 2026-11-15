import type { Metadata } from "next";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BrollSlot, type BrollState } from "@/components/broll-slot";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/labels";

export const metadata: Metadata = { title: "B-roll" };

/** The client's b-roll drop box: what to shoot, how to shoot it, and a submission box for each. */
export default async function PortalBrollPage() {
  await requireClient();
  const supabase = await createClient();
  // Row level security: only this client's own list and clips come back.
  const [{ data: requests }, { data: submissions }] = await Promise.all([
    supabase.from("broll_requests").select("*").order("sort_order").order("created_at"),
    supabase
      .from("broll_submissions")
      .select("request_id, check_status, feedback")
      .eq("superseded", false),
  ]);

  const stateFor = (requestId: string): BrollState => {
    const sub = submissions?.find((s) => s.request_id === requestId);
    return sub ? { status: sub.check_status, advice: sub.feedback } : null;
  };
  const todo = (requests ?? []).filter((r) => r.status !== "accepted");
  const done = (requests ?? []).filter((r) => r.status === "accepted");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-3xl text-ink">B-roll</h1>
        <p className="mt-1 text-ink-2">
          Short clips we cut into your videos. Each one says what to film and how. Send one clip per box.
        </p>
      </header>

      {!requests?.length ? (
        <EmptyState title="Nothing to film yet">We will add your b-roll list here and email you.</EmptyState>
      ) : (
        <>
          {todo.length === 0 && (
            <Card className="border-success">
              <p className="font-semibold text-success">All done. Every clip on your list is in.</p>
            </Card>
          )}
          {todo.map((r) => (
            <Card key={r.id} className={r.status === "needs_reshoot" ? "border-danger" : undefined}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-display text-xl text-ink">{r.title}</h2>
                {r.due_date && <Badge tone="warning">Due {formatDate(r.due_date)}</Badge>}
              </div>
              {r.instructions && (
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-ink">How to shoot it</h3>
                  <p className="mt-1 whitespace-pre-wrap text-ink">{r.instructions}</p>
                </div>
              )}
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-ink-3">Hold phone</dt>
                <dd>{r.orientation === "portrait" ? "Upright (portrait)" : "Sideways (landscape)"}</dd>
                <dt className="text-ink-3">Length</dt>
                <dd>At least {r.min_duration_seconds} seconds</dd>
              </dl>
              {r.reference_url && (
                <p className="mt-3 text-sm">
                  <a href={r.reference_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold-hover underline">
                    Watch an example
                  </a>
                </p>
              )}
              <BrollSlot requestId={r.id} current={stateFor(r.id)} canSubmit />
            </Card>
          ))}

          {done.length > 0 && (
            <section aria-labelledby="done-heading">
              <h2 id="done-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-2">
                Done
              </h2>
              <ul className="divide-y divide-line panel border border-ink/[0.06]">
                {done.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-ink">{r.title}</span>
                    <Badge tone="success">Accepted</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
