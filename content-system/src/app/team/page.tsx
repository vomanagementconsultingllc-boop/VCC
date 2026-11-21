import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink, EmptyState, Eyebrow, PageHeader } from "@/components/ui";
import { ClientGrid, NeedsYou } from "@/components/team/needs-you";
import { CLIENT_STATUS } from "@/lib/labels";
import { pipelineHealth } from "@/lib/pipeline-health";
import { teamTodo } from "@/lib/team-todo";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: clients }, { data: scripts }, { data: submitted }] = await Promise.all([
    supabase.from("clients").select("id, name, business, status").order("status").order("name"),
    // Every video still in progress: the to-do list and each client's summary come from these.
    supabase
      .from("scripts")
      .select(
        "id, title, client_id, stage, footage_requested_at, client:clients(name, business), brief:shooting_briefs(due_date)",
      )
      .not("stage", "in", "(delivered,posted)")
      .order("updated_at"),
    supabase.from("edit_jobs").select("id, script_id").eq("status", "submitted"),
  ]);
  const now = new Date();
  const health = pipelineHealth(scripts ?? [], now);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="What needs you today, then everyone you make videos for."
        actions={<ButtonLink href="/team/clients/new">New client</ButtonLink>}
      />
      <NeedsYou groups={teamTodo(scripts ?? [], submitted ?? [], now)} videosHref="/team/videos" />
      <Eyebrow className="mb-3 text-ink-2">Your clients</Eyebrow>
      {!clients?.length ? (
        <EmptyState title="No clients yet">
          Add your first client. They get an email to sign in and answer a few questions.
        </EmptyState>
      ) : (
        <ClientGrid
          clients={clients.map((c) => ({
            id: c.id,
            href: `/team/clients/${c.id}`,
            title: c.business || c.name,
            person: c.business ? c.name : undefined,
            status: c.status === "active" ? undefined : CLIENT_STATUS[c.status],
            health: health.get(c.id),
          }))}
        />
      )}
    </>
  );
}
