import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardTitle, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { formatDateTime } from "@/lib/labels";
import { isUuid } from "@/lib/forms";
import { INTAKE_FIELDS, LOGISTICS_QUESTIONS, VOICE_QUESTIONS, type IntakeAnswers } from "@/lib/onboarding";
import { resolveCorrection, saveVoiceProfile } from "../../actions";
import { ClientTabs } from "../client-tabs";

export const metadata: Metadata = { title: "Voice profile" };

export default async function VoicePage({ params }: PageProps<"/team/clients/[id]/voice">) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: client }, { data: voice }, { data: corrections }] = await Promise.all([
    supabase.from("clients").select("id, name, business").eq("id", id).maybeSingle(),
    supabase.from("voice_profiles").select("*").eq("client_id", id).maybeSingle(),
    supabase
      .from("voice_corrections")
      .select("id, body, created_at, resolved_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!client) notFound();

  const intake = (voice?.intake_answers ?? {}) as IntakeAnswers;
  const examples = Array.isArray(voice?.example_posts) ? (voice.example_posts as string[]) : [];
  const open = corrections?.filter((c) => !c.resolved_at) ?? [];

  return (
    <>
      <PageHeader
        title={client.business || client.name}
        subtitle="Voice profile: how this client actually talks."
        back={{ href: "/team", label: "Clients" }}
      />
      <ClientTabs clientId={client.id} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardTitle>Voice profile</CardTitle>
            <ActionForm action={saveVoiceProfile} className="space-y-4">
              <input type="hidden" name="client_id" value={client.id} />
              <Field
                label="Onboarding call transcript"
                hint="Paste the Fireflies transcript of the onboarding call. The rambling is the data."
              >
                <Textarea name="interview_transcript" rows={10} defaultValue={voice?.interview_transcript} />
              </Field>
              <Field label="Transcript source" hint="Fireflies meeting link or id, for reference.">
                <Input name="interview_source" defaultValue={voice?.interview_source} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Words and phrases they use" hint="One per line.">
                  <Textarea name="phrases_use" rows={6} defaultValue={voice?.phrases_use.join("\n")} />
                </Field>
                <Field label="Words they never use" hint="One per line. Scripts must avoid these.">
                  <Textarea name="phrases_never" rows={6} defaultValue={voice?.phrases_never.join("\n")} />
                </Field>
              </div>
              <Field label="Tone notes" hint="Internal. How they sound: pace, humour, formality.">
                <Textarea name="tone_notes" defaultValue={voice?.tone_notes} />
              </Field>
              <Field label="Topics they will not talk about" hint="One per line.">
                <Textarea name="topics_avoid" rows={3} defaultValue={voice?.topics_avoid.join("\n")} />
              </Field>
              <Field label="Their offer, in their words">
                <Textarea name="offer" defaultValue={voice?.offer} />
              </Field>
              <Field label="Who they are trying to reach">
                <Textarea name="audience" defaultValue={voice?.audience} />
              </Field>
              <Field
                label="Example posts that sound like them"
                hint="Two or three. Paste the text or a link. Leave a blank line between each."
              >
                <Textarea name="example_posts" rows={6} defaultValue={examples.join("\n\n")} />
              </Field>
              <Field
                label="Summary the client sees"
                hint="One page: how we heard them. Shown in their portal with a way to correct it."
              >
                <Textarea name="summary" rows={6} defaultValue={voice?.summary} />
              </Field>

              <fieldset className="rounded-lg border border-line p-4">
                <legend className="px-1 text-sm font-semibold text-ink">Logistics from the call</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {INTAKE_FIELDS.map((f) => (
                    <Field key={f.key} label={f.label}>
                      <Input name={`intake_${f.key}`} defaultValue={intake[f.key] ?? ""} />
                    </Field>
                  ))}
                </div>
              </fieldset>

              <SubmitButton>Save voice profile</SubmitButton>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitle action={open.length ? <Badge tone="warning">{open.length} open</Badge> : undefined}>
              Corrections from the client
            </CardTitle>
            {corrections?.length ? (
              <ul className="divide-y divide-line">
                {corrections.map((c) => (
                  <li key={c.id} className="py-3 text-sm">
                    <p className="whitespace-pre-wrap text-ink">{c.body}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-ink-3">{formatDateTime(c.created_at)}</span>
                      {c.resolved_at ? (
                        <Badge tone="success">Handled</Badge>
                      ) : (
                        <form action={resolveCorrection}>
                          <input type="hidden" name="correction_id" value={c.id} />
                          <SubmitButton variant="secondary" pendingLabel="Saving…">
                            Mark handled
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2">None yet. Clients can send corrections from their settings page.</p>
            )}
          </Card>

          <Card>
            <CardTitle>Onboarding call guide</CardTitle>
            <p className="mb-3 text-sm text-ink-2">
              30 to 40 minutes, recorded on Fireflies. Ask every question. Let them ramble.
            </p>
            <details open className="mb-3">
              <summary className="cursor-pointer text-sm font-semibold">Questions that pull real phrasing</summary>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-ink-2">
                {VOICE_QUESTIONS.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </details>
            <details>
              <summary className="cursor-pointer text-sm font-semibold">Questions that fill in logistics</summary>
              <ol start={VOICE_QUESTIONS.length + 1} className="mt-2 list-decimal space-y-2 pl-5 text-sm text-ink-2">
                {LOGISTICS_QUESTIONS.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </details>
          </Card>
        </div>
      </div>
    </>
  );
}
