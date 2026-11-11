import type { Metadata } from "next";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { SignOutButton } from "@/components/sign-out";
import { Card, CardTitle, Field, Input, Textarea, buttonClass } from "@/components/ui";
import { CLIENT_NOTIFICATIONS, wantsEmail } from "@/lib/notification-prefs";
import { savePreferences, sendVoiceCorrection } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function PortalSettings() {
  const user = await requireClient();
  const supabase = await createClient();
  const [{ data: summaryRows }, { data: profile }] = await Promise.all([
    supabase.rpc("my_voice_summary"),
    supabase.from("profiles").select("notification_prefs").eq("id", user.id).maybeSingle(),
  ]);
  const voice = summaryRows?.[0];

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-ink">Settings</h1>

      <Card>
        <CardTitle>How we heard you</CardTitle>
        {voice?.summary ? (
          <p className="whitespace-pre-wrap text-ink">{voice.summary}</p>
        ) : (
          <p className="text-sm text-ink-2">
            We are still writing up your voice profile from our call. It will show here soon.
          </p>
        )}
        {voice && (voice.phrases_use.length > 0 || voice.phrases_never.length > 0) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {voice.phrases_use.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">Things you say</h3>
                <ul className="mt-1 list-disc pl-5 text-sm text-ink-2">
                  {voice.phrases_use.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {voice.phrases_never.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">Things you would never say</h3>
                <ul className="mt-1 list-disc pl-5 text-sm text-ink-2">
                  {voice.phrases_never.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <ActionForm action={sendVoiceCorrection} resetOnSuccess className="mt-5">
          <Field label="Did we get something wrong?" hint="Tell us in your own words and we will fix it.">
            <Textarea name="body" required placeholder="I would never say 'pamper yourself'. I say 'look after yourself'." />
          </Field>
          <div className="mt-3">
            <SubmitButton variant="secondary" pendingLabel="Sending…">
              Send correction
            </SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <Card>
        <CardTitle>Your details and emails</CardTitle>
        <ActionForm action={savePreferences} className="space-y-4">
          <Field label="Your name">
            <Input name="full_name" defaultValue={user.fullName} autoComplete="name" />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink">Email me when</legend>
            <div className="space-y-3">
              {CLIENT_NOTIFICATIONS.map((n) => (
                <label key={n.key} className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name={n.key}
                    className="size-5"
                    defaultChecked={wantsEmail(profile?.notification_prefs, n.key)}
                  />
                  {n.label}
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </Card>

      <Card>
        <p className="mb-3 text-sm text-ink-2">Signed in as {user.email}</p>
        <SignOutButton className={buttonClass("secondary")} />
      </Card>
    </div>
  );
}
