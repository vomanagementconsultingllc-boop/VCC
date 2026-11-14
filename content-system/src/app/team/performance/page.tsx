import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { FORMATS, one, type VideoFormat } from "@/lib/labels";

export const metadata: Metadata = { title: "Performance" };

const HOOK_LABEL: Record<string, string> = {
  question: "Question",
  bold_claim: "Bold claim",
  contrarian: "Contrarian",
  story_open: "Story open",
  number_list: "Number list",
};

function dollars(cents: number): string {
  return "$" + (cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function tally(items: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export default async function PerformancePage() {
  const user = await requireStaff();
  const supabase = await createClient();
  const [
    { data: clients },
    { data: scripts },
    { data: uses },
    { data: logs },
    { data: financials },
    { data: costs },
    { data: deliverables },
  ] = await Promise.all([
    supabase.from("clients").select("id, name, business").neq("status", "offboarded").order("business"),
    supabase.from("scripts").select("client_id, stage, format"),
    supabase.from("hook_uses").select("client_id, hook:hooks(format_type)"),
    supabase.from("performance_logs").select("client_id, platform, views_7d"),
    // The next two return nothing for team members: pricing and costs are admin only.
    supabase.from("client_financials").select("client_id, price_per_video_cents"),
    supabase.from("edit_job_costs").select("client_id, cost_cents"),
    supabase.from("deliverables").select("client_id"),
  ]);

  const hasNumbers = (logs ?? []).some((l) => l.views_7d != null);

  return (
    <>
      <PageHeader title="Performance" subtitle="Which hooks and formats each client is using, and what has gone out." />
      {!hasNumbers && (
        <p className="mb-5 rounded-lg bg-info-soft px-4 py-3 text-sm text-ink">
          View counts are not collected yet. They will appear here once platform API access is set up; until then this
          page shows what was made and posted.
        </p>
      )}
      {!clients?.length ? (
        <EmptyState title="No clients yet" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {clients.map((client) => {
            const own = (scripts ?? []).filter((s) => s.client_id === client.id);
            const made = own.filter((s) => s.stage === "delivered" || s.stage === "posted");
            const posted = own.filter((s) => s.stage === "posted").length;
            const formats = tally(made.map((s) => s.format));
            const hookTypes = tally(
              (uses ?? []).filter((u) => u.client_id === client.id).map((u) => one(u.hook)?.format_type ?? "unknown"),
            );
            const platforms = tally((logs ?? []).filter((l) => l.client_id === client.id).map((l) => l.platform));
            const delivered = (deliverables ?? []).filter((d) => d.client_id === client.id).length;
            const price = (financials ?? []).find((f) => f.client_id === client.id)?.price_per_video_cents ?? 0;
            const cost = (costs ?? []).filter((c) => c.client_id === client.id).reduce((sum, c) => sum + c.cost_cents, 0);
            return (
              <Card key={client.id}>
                <CardTitle>{client.business || client.name}</CardTitle>
                <dl className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-surface-2 p-3">
                    <dt className="text-xs text-ink-2">In progress</dt>
                    <dd className="font-display text-2xl text-ink">{own.length - made.length}</dd>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-3">
                    <dt className="text-xs text-ink-2">Delivered</dt>
                    <dd className="font-display text-2xl text-ink">{made.length}</dd>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-3">
                    <dt className="text-xs text-ink-2">Posted</dt>
                    <dd className="font-display text-2xl text-ink">{posted}</dd>
                  </div>
                </dl>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-ink">Formats:</span>
                    {formats.length ? (
                      formats.map(([f, n]) => (
                        <Badge key={f}>
                          {FORMATS[f as VideoFormat] ?? f} × {n}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-ink-3">none yet</span>
                    )}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-ink">Hook types:</span>
                    {hookTypes.length ? (
                      hookTypes.map(([h, n]) => (
                        <Badge key={h} tone="gold">
                          {HOOK_LABEL[h] ?? "Other"} × {n}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-ink-3">none yet</span>
                    )}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-ink">Posted on:</span>
                    {platforms.length ? (
                      platforms.map(([p, n]) => (
                        <Badge key={p} tone="success">
                          {p} × {n}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-ink-3">nothing marked as posted</span>
                    )}
                  </p>
                </div>
                {user.role === "admin" && (
                  <p className="mt-4 border-t border-line pt-3 text-sm text-ink-2">
                    <span className="font-semibold text-ink">Margin (admin only): </span>
                    {delivered} delivered × {dollars(price)} = {dollars(delivered * price)} · edits {dollars(cost)} ·{" "}
                    <span className="font-semibold text-ink">{dollars(delivered * price - cost)}</span>
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
