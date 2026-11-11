import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardTitle, Field, Input, PageHeader, Select } from "@/components/ui";
import { ROLE_LABEL, formatDateTime, one } from "@/lib/labels";
import { centsToDollars } from "@/lib/forms";
import { createAccessKey, inviteInternalUser, removeInternalUser, revokeAccessKey, saveSettings } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireAdmin();
  const supabase = await createClient();
  const [{ data: people }, { data: settings }, { data: keys }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["admin", "team", "editor"])
      .order("role")
      .order("full_name"),
    supabase.from("app_settings").select("revision_allowance, default_edit_cost_cents").maybeSingle(),
    supabase
      .from("editor_access_keys")
      .select("id, label, key_prefix, created_at, last_used_at, revoked_at, editor:profiles!editor_access_keys_editor_id_fkey(full_name, email)")
      .order("created_at", { ascending: false }),
  ]);
  const editors = (people ?? []).filter((p) => p.role === "editor");

  return (
    <>
      <PageHeader title="Settings" subtitle="Admin only." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Team and editors</CardTitle>
          <ul className="mb-5 divide-y divide-line">
            {people?.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-semibold">{p.full_name || "No name"}</span>
                  <span className="block text-ink-2">{p.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={p.role === "admin" ? "gold" : "neutral"}>{ROLE_LABEL[p.role]}</Badge>
                  {p.id !== user.id && (
                    <form action={removeInternalUser}>
                      <input type="hidden" name="user_id" value={p.id} />
                      <SubmitButton
                        variant="ghost"
                        pendingLabel="Removing…"
                        confirm={`Remove ${p.email}? They will no longer be able to sign in.`}
                      >
                        Remove
                      </SubmitButton>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <ActionForm action={inviteInternalUser} resetOnSuccess className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input name="full_name" />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" required />
              </Field>
            </div>
            <Field
              label="Role"
              hint="Team members run clients, research, scripts and the pipeline. Editors only see jobs assigned to them."
            >
              <Select name="role" defaultValue="team">
                <option value="team">Team member</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
            <SubmitButton variant="secondary" pendingLabel="Sending…">
              Send invite
            </SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <CardTitle>Editing</CardTitle>
          <ActionForm action={saveSettings} className="space-y-4">
            <Field
              label="Revisions included per video"
              hint="Leave blank until you decide. Jobs that go past this number are flagged as over."
            >
              <Input
                name="revision_allowance"
                inputMode="numeric"
                defaultValue={settings?.revision_allowance ?? ""}
                placeholder="Not set"
              />
            </Field>
            <Field label="Default cost per edit (USD)" hint="Pre-fills the cost on each new edit job.">
              <Input
                name="default_edit_cost"
                inputMode="decimal"
                defaultValue={centsToDollars(settings?.default_edit_cost_cents)}
              />
            </Field>
            <SubmitButton>Save settings</SubmitButton>
          </ActionForm>
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle>Access keys for Claude editing</CardTitle>
          <p className="mb-4 text-sm text-ink-2">
            A key lets a Claude session work as one editor seat: it can see only the jobs assigned to that seat,
            download their raw clips and upload a cut. Invite an editor seat above first (an email alias you own works),
            then create its key. Every cut still waits for your review.
          </p>
          {keys?.length ? (
            <ul className="mb-5 divide-y divide-line">
              {keys.map((k) => {
                const editor = one(k.editor);
                return (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-semibold">{k.label || "Access key"}</span>{" "}
                      <code className="text-ink-2">{k.key_prefix}…</code>
                      <span className="block text-ink-2">
                        {editor?.full_name || editor?.email} · created {formatDateTime(k.created_at)} ·{" "}
                        {k.last_used_at ? `last used ${formatDateTime(k.last_used_at)}` : "never used"}
                      </span>
                    </span>
                    {k.revoked_at ? (
                      <Badge tone="neutral">Revoked</Badge>
                    ) : (
                      <form action={revokeAccessKey}>
                        <input type="hidden" name="key_id" value={k.id} />
                        <SubmitButton variant="ghost" pendingLabel="Revoking…" confirm="Revoke this key? Anything using it stops working.">
                          Revoke
                        </SubmitButton>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {editors.length === 0 ? (
            <p className="text-sm text-ink-2">Invite an editor first, then you can create a key for that seat.</p>
          ) : (
            <ActionForm action={createAccessKey} className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Editor seat</span>
                <Select name="editor_id" className="min-w-56">
                  {editors.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name || e.email}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Label</span>
                <Input name="label" placeholder="Claude editing" />
              </label>
              <SubmitButton variant="secondary" pendingLabel="Creating…">
                Create key
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
      </div>
    </>
  );
}
