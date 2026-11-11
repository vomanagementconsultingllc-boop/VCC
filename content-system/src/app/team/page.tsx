import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { CLIENT_STATUS, one } from "@/lib/labels";
import { pipelineHealth } from "@/lib/pipeline-health";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, business, niche_tags, status, assigned:profiles!clients_assigned_team_member_fkey(full_name, email)")
    .order("status")
    .order("name");

  // Pipeline health per client: what is stuck, and on whom.
  const { data: scripts } = await supabase
    .from("scripts")
    .select("client_id, stage, footage_requested_at, brief:shooting_briefs(due_date)")
    .in("stage", ["sent_to_client", "awaiting_footage", "footage_received", "in_edit", "review"]);
  const health = pipelineHealth(scripts ?? [], new Date());

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Everyone on the done-with-you offer, and what is stuck where."
        actions={<ButtonLink href="/team/clients/new">New client</ButtonLink>}
      />
      {!clients?.length ? (
        <EmptyState title="No clients yet">Add your first client to start their voice profile.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/team/clients/${c.id}`}
                className="block h-full rounded-xl border border-line bg-surface p-5 hover:border-gold"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{c.business || c.name}</p>
                    {c.business && <p className="text-sm text-ink-2">{c.name}</p>}
                  </div>
                  <Badge tone={CLIENT_STATUS[c.status].tone}>{CLIENT_STATUS[c.status].label}</Badge>
                </div>
                <p className="mt-3 text-sm text-ink-2">{c.niche_tags.join(" · ") || "No niche tags yet"}</p>
                <p className="mt-1 text-xs text-ink-3">
                  {one(c.assigned) ? `Assigned to ${one(c.assigned)?.full_name || one(c.assigned)?.email}` : "Unassigned"}
                </p>
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {health.get(c.id)?.waiting ? (
                    <Badge tone="warning">{health.get(c.id)?.waiting} waiting on client</Badge>
                  ) : null}
                  {health.get(c.id)?.overdue ? <Badge tone="danger">{health.get(c.id)?.overdue} footage overdue</Badge> : null}
                  {health.get(c.id)?.editing ? <Badge tone="gold">{health.get(c.id)?.editing} in the edit queue</Badge> : null}
                  {!health.get(c.id) && <Badge>Nothing in progress</Badge>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
