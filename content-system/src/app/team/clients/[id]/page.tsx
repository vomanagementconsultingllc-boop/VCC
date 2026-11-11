import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ClientFields } from "@/components/client-form";
import { Badge, Card, CardTitle, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { CLIENT_STATUS, formatDateTime } from "@/lib/labels";
import { centsToDollars, isUuid } from "@/lib/forms";
import {
  addClientNote,
  inviteClientLogin,
  removeClientLogin,
  saveFinancials,
  updateClientRecord,
} from "../actions";
import { ClientTabs } from "./client-tabs";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: PageProps<"/team/clients/[id]">) {
  const user = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: client }, { data: staff }, { data: logins }, { data: notes }, { data: financials }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", id).maybeSingle(),
      supabase.from("profiles").select("id, full_name, email").in("role", ["admin", "team"]).order("full_name"),
      supabase.from("profiles").select("id, full_name, email, created_at").eq("client_id", id).order("created_at"),
      supabase
        .from("client_notes")
        .select("id, body, created_at, author:profiles!client_notes_created_by_fkey(full_name)")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      // Row level security returns nothing here for team members.
      supabase.from("client_financials").select("price_per_video_cents, notes").eq("client_id", id).maybeSingle(),
    ]);
  if (!client) notFound();

  return (
    <>
      <PageHeader
        title={client.business || client.name}
        subtitle={client.business ? client.name : undefined}
        back={{ href: "/team", label: "Clients" }}
        actions={<Badge tone={CLIENT_STATUS[client.status].tone}>{CLIENT_STATUS[client.status].label}</Badge>}
      />
      <ClientTabs clientId={client.id} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Details</CardTitle>
          <ActionForm action={updateClientRecord}>
            <input type="hidden" name="client_id" value={client.id} />
            <ClientFields client={client} staff={staff ?? []} />
            <div className="mt-5">
              <SubmitButton>Save details</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardTitle>Portal logins</CardTitle>
            {logins?.length ? (
              <ul className="mb-4 divide-y divide-line">
                {logins.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-semibold">{l.full_name || "No name"}</span>
                      <span className="block text-ink-2">{l.email}</span>
                    </span>
                    <form action={removeClientLogin}>
                      <input type="hidden" name="user_id" value={l.id} />
                      <SubmitButton
                        variant="ghost"
                        pendingLabel="Removing…"
                        confirm={`Remove ${l.email}? They will no longer be able to sign in.`}
                      >
                        Remove
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-ink-2">Nobody from this client can sign in yet.</p>
            )}
            <ActionForm action={inviteClientLogin} resetOnSuccess className="space-y-3">
              <input type="hidden" name="client_id" value={client.id} />
              <Field label="Name">
                <Input name="full_name" placeholder="Allison Reed" />
              </Field>
              <Field label="Email" hint="They get an invite link. No password.">
                <Input name="email" type="email" required placeholder="allison@reeddental.com" />
              </Field>
              <SubmitButton variant="secondary" pendingLabel="Sending…">
                Send invite
              </SubmitButton>
            </ActionForm>
          </Card>

          {user.role === "admin" && (
            <Card>
              <CardTitle>Pricing</CardTitle>
              <p className="mb-3 text-sm text-ink-2">Admin only. Used to show margin per client.</p>
              <ActionForm action={saveFinancials} className="space-y-3">
                <input type="hidden" name="client_id" value={client.id} />
                <Field label="Price per video (USD)">
                  <Input
                    name="price_per_video"
                    inputMode="decimal"
                    defaultValue={centsToDollars(financials?.price_per_video_cents)}
                    placeholder="150"
                  />
                </Field>
                <Field label="Notes">
                  <Textarea name="notes" defaultValue={financials?.notes ?? ""} />
                </Field>
                <SubmitButton variant="secondary">Save pricing</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>

        <Card className="lg:col-span-3">
          <CardTitle>Internal notes</CardTitle>
          <p className="mb-3 text-sm text-ink-2">Only the team sees these. The client never does.</p>
          <ActionForm action={addClientNote} resetOnSuccess className="mb-4">
            <input type="hidden" name="client_id" value={client.id} />
            <Textarea name="body" required placeholder="Prefers Tuesday shoots. Nervous on camera, keep scripts short." />
            <div className="mt-3">
              <SubmitButton variant="secondary">Add note</SubmitButton>
            </div>
          </ActionForm>
          {notes?.length ? (
            <ul className="divide-y divide-line">
              {notes.map((n) => (
                <li key={n.id} className="py-3 text-sm">
                  <p className="whitespace-pre-wrap text-ink">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {n.author?.full_name || "Team"} · {formatDateTime(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
    </>
  );
}
