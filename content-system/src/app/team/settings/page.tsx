import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardTitle, Field, Input, PageHeader, Select } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/labels";
import { centsToDollars } from "@/lib/forms";
import { inviteInternalUser, removeInternalUser, saveSettings } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireAdmin();
  const supabase = await createClient();
  const [{ data: people }, { data: settings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["admin", "team", "editor"])
      .order("role")
      .order("full_name"),
    supabase.from("app_settings").select("revision_allowance, default_edit_cost_cents").maybeSingle(),
  ]);

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
      </div>
    </>
  );
}
