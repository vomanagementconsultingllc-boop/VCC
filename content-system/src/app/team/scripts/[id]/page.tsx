import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardTitle, PageHeader, Textarea } from "@/components/ui";
import { STAGES, formatDateTime } from "@/lib/labels";
import { isUuid } from "@/lib/forms";
import { addTeamComment, deleteScript, pullBackScript, sendToClient } from "../actions";
import { FootageCard } from "./footage-card";
import { ScriptEditor } from "./script-editor";

export const metadata: Metadata = { title: "Script" };

export default async function ScriptPage({ params }: PageProps<"/team/scripts/[id]">) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: script } = await supabase.from("scripts").select("*").eq("id", id).maybeSingle();
  if (!script) notFound();

  const [
    { data: client },
    { data: internal },
    { data: brief },
    { data: shots },
    { data: voice },
    { data: comments },
    { data: uploads },
  ] = await Promise.all([
      supabase.from("clients").select("id, name, business").eq("id", script.client_id).maybeSingle(),
      supabase.from("script_internal").select("*").eq("script_id", id).maybeSingle(),
      supabase.from("shooting_briefs").select("*").eq("script_id", id).maybeSingle(),
      supabase.from("shots").select("*").eq("script_id", id).order("shot_number"),
      supabase
        .from("voice_profiles")
        .select("phrases_use, phrases_never, tone_notes, topics_avoid, offer, audience")
        .eq("client_id", script.client_id)
        .maybeSingle(),
      supabase
        .from("script_comments")
        .select("id, body, kind, created_at, author:profiles!script_comments_author_id_fkey(full_name, role)")
        .eq("script_id", id)
        .order("created_at"),
      supabase.from("footage_uploads").select("*").eq("script_id", id).order("uploaded_at", { ascending: false }),
    ]);
  const footageStage = ["awaiting_footage", "footage_received", "in_edit", "review"].includes(script.stage);

  const stage = STAGES[script.stage];
  const isDraft = script.stage === "scripted" || script.stage === "research";
  const clientName = client?.business || client?.name || "Client";

  return (
    <>
      <PageHeader
        title={script.title}
        subtitle={
          <>
            <Link href={`/team/clients/${script.client_id}/scripts`} className="font-semibold text-gold">
              {clientName}
            </Link>{" "}
            · version {script.version}
          </>
        }
        back={{ href: "/team/pipeline", label: "Pipeline" }}
        actions={<Badge tone={stage.tone}>{stage.label}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {(footageStage || (uploads?.length ?? 0) > 0) && (
            <FootageCard
              shots={shots ?? []}
              uploads={uploads ?? []}
              canUpload={script.stage === "awaiting_footage" || script.stage === "footage_received"}
            />
          )}
          <ScriptEditor
            key={`${script.id}-${script.updated_at}`}
            neverSay={voice?.phrases_never ?? []}
            initial={{
              id: script.id,
              title: script.title,
              hook: script.hook,
              body: script.body,
              format: script.format,
              internalNotes: internal?.internal_notes ?? "",
              styleNotes: internal?.style_notes ?? "",
              referenceUrl: brief?.reference_url ?? "",
              briefNotes: brief?.notes ?? "",
              dueDate: brief?.due_date ?? null,
              shots: (shots ?? []).map((s) => ({
                id: s.id,
                instruction: s.instruction,
                lines: s.lines,
                framing: s.framing,
                orientation: s.orientation,
                minDuration: s.min_duration_seconds,
                whereToLook: s.where_to_look,
                lightingNotes: s.lighting_notes,
              })),
            }}
          />
        </div>

        <aside className="space-y-5">
          <Card>
            <CardTitle>Status</CardTitle>
            <p className="mb-3 text-sm text-ink-2">
              {isDraft && "Draft. The client cannot see this until you send it. Save your changes first."}
              {script.stage === "sent_to_client" && `Waiting on the client since ${formatDateTime(script.sent_at)}.`}
              {script.stage === "awaiting_footage" &&
                `Approved ${formatDateTime(script.client_approved_at)}. Waiting for footage.`}
              {!isDraft &&
                script.stage !== "sent_to_client" &&
                script.stage !== "awaiting_footage" &&
                `In progress: ${stage.label.toLowerCase()}.`}
            </p>
            {isDraft && (
              <ActionForm action={sendToClient}>
                <input type="hidden" name="script_id" value={script.id} />
                <SubmitButton pendingLabel="Sending…" className="w-full">
                  Send to client
                </SubmitButton>
              </ActionForm>
            )}
            {script.stage === "sent_to_client" && (
              <ActionForm action={pullBackScript}>
                <input type="hidden" name="script_id" value={script.id} />
                <SubmitButton variant="secondary" pendingLabel="Pulling back…" className="w-full">
                  Pull back to draft
                </SubmitButton>
              </ActionForm>
            )}
            {isDraft && (
              <form action={deleteScript} className="mt-3">
                <input type="hidden" name="script_id" value={script.id} />
                <SubmitButton
                  variant="ghost"
                  pendingLabel="Deleting…"
                  className="w-full"
                  confirm="Delete this draft? This cannot be undone."
                >
                  Delete draft
                </SubmitButton>
              </form>
            )}
          </Card>

          <Card>
            <CardTitle
              action={
                <Link href={`/team/clients/${script.client_id}/voice`} className="text-sm font-semibold text-gold">
                  Edit
                </Link>
              }
            >
              Voice profile
            </CardTitle>
            {voice ? (
              <div className="space-y-3 text-sm">
                <VoiceList title="They say" items={voice.phrases_use} />
                <VoiceList title="They never say" items={voice.phrases_never} tone="danger" />
                <VoiceList title="Will not talk about" items={voice.topics_avoid} tone="danger" />
                {voice.tone_notes && <VoiceText title="Tone" text={voice.tone_notes} />}
                {voice.offer && <VoiceText title="Their offer" text={voice.offer} />}
                {voice.audience && <VoiceText title="Audience" text={voice.audience} />}
              </div>
            ) : (
              <p className="text-sm text-ink-2">No voice profile yet.</p>
            )}
          </Card>

          <Card>
            <CardTitle>Comments with the client</CardTitle>
            {comments?.length ? (
              <ul className="mb-4 space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                    <p className="whitespace-pre-wrap text-ink">{c.body}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                      {c.author?.full_name || (c.author?.role === "client" ? "Client" : "Team")} ·{" "}
                      {formatDateTime(c.created_at)}
                      {c.kind === "change_request" && <Badge tone="warning">Change request</Badge>}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-ink-2">No comments yet.</p>
            )}
            <ActionForm action={addTeamComment} resetOnSuccess>
              <input type="hidden" name="script_id" value={script.id} />
              <Textarea name="body" required className="min-h-20" placeholder="Reply to the client" />
              <div className="mt-3">
                <SubmitButton variant="secondary" pendingLabel="Posting…">
                  Post comment
                </SubmitButton>
              </div>
            </ActionForm>
          </Card>
        </aside>
      </div>
    </>
  );
}

function VoiceList({ title, items, tone }: { title: string; items: string[]; tone?: "danger" }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="font-semibold text-ink">{title}</h3>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item}>
            <Badge tone={tone ?? "neutral"}>{item}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VoiceText({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-1 whitespace-pre-wrap text-ink-2">{text}</p>
    </div>
  );
}
