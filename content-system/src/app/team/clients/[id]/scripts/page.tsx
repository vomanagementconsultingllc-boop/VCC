import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { planWeek } from "../../../research/actions";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { FORMATS, STAGES, STAGE_NOW, formatDate } from "@/lib/labels";
import { isUuid } from "@/lib/forms";
import { createScript } from "../../../scripts/actions";
import { ClientTabs } from "../client-tabs";

export const metadata: Metadata = { title: "Videos" };

export default async function ClientScriptsPage({ params }: PageProps<"/team/clients/[id]/scripts">) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: client }, { data: scripts }] = await Promise.all([
    supabase.from("clients").select("id, name, business").eq("id", id).maybeSingle(),
    supabase
      .from("scripts")
      .select("id, title, stage, format, version, updated_at")
      .eq("client_id", id)
      .order("updated_at", { ascending: false }),
  ]);
  if (!client) notFound();

  return (
    <>
      <PageHeader
        title={client.business || client.name}
        subtitle="Videos"
        back={{ href: "/team", label: "Clients" }}
        actions={
          <form action={createScript}>
            <input type="hidden" name="client_id" value={client.id} />
            <SubmitButton pendingLabel="Creating…">New video</SubmitButton>
          </form>
        }
      />
      <ClientTabs clientId={client.id} />
      <ActionForm action={planWeek} className="panel mb-5 border border-ink/10 p-5">
        <input type="hidden" name="client_id" value={client.id} />
        <p className="font-semibold text-ink">Plan this week</p>
        <p className="mb-3 mt-1 text-sm text-ink-2">
          Picks the seven best hooks this client has not used and starts a video for each, with its inspiration link.
          Write each script (or let AI draft it), check it, and send it. The client sees them under Plan.
        </p>
        <SubmitButton variant="secondary" pendingLabel="Planning…">
          Plan 7 videos for this week
        </SubmitButton>
      </ActionForm>
      {!scripts?.length ? (
        <EmptyState title="No videos yet">Plan a week above, or start a single video with New video.</EmptyState>
      ) : (
        <ul className="divide-y divide-line panel border border-ink/[0.06]">
          {scripts.map((s) => (
            <li key={s.id}>
              <Link href={`/team/scripts/${s.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{s.title}</span>
                  <span className="text-sm text-ink-2">
                    {FORMATS[s.format]} · v{s.version} · updated {formatDate(s.updated_at)}
                  </span>
                </span>
                <Badge tone={STAGES[s.stage].waitingOn === "team" ? "gold" : "neutral"}>{STAGE_NOW[s.stage]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
