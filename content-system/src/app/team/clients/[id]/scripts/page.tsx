import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/action-form";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { FORMATS, STAGES, formatDate } from "@/lib/labels";
import { isUuid } from "@/lib/forms";
import { createScript } from "../../../scripts/actions";
import { ClientTabs } from "../client-tabs";

export const metadata: Metadata = { title: "Scripts" };

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
        subtitle="Scripts"
        back={{ href: "/team", label: "Clients" }}
        actions={
          <form action={createScript}>
            <input type="hidden" name="client_id" value={client.id} />
            <SubmitButton pendingLabel="Creating…">New script</SubmitButton>
          </form>
        }
      />
      <ClientTabs clientId={client.id} />
      {!scripts?.length ? (
        <EmptyState title="No scripts yet">Start one from here, or from the research board.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {scripts.map((s) => (
            <li key={s.id}>
              <Link href={`/team/scripts/${s.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{s.title}</span>
                  <span className="text-sm text-ink-2">
                    {FORMATS[s.format]} · v{s.version} · updated {formatDate(s.updated_at)}
                  </span>
                </span>
                <Badge tone={STAGES[s.stage].tone}>{STAGES[s.stage].label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
