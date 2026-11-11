import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { StageChecklist } from "@/components/stage-checklist";
import { Teleprompter } from "@/components/teleprompter";
import { Badge, Card, CardTitle, Field, Textarea } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/labels";
import { isUuid } from "@/lib/forms";
import { addClientComment, approveScript, requestChanges } from "../../actions";

export const metadata: Metadata = { title: "Script" };

export default async function PortalScriptPage({ params }: PageProps<"/portal/scripts/[id]">) {
  await requireClient();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  // Row level security only returns this client's own, already-sent scripts.
  const supabase = await createClient();
  const { data: script } = await supabase
    .from("scripts")
    .select("id, title, hook, body, stage, version")
    .eq("id", id)
    .maybeSingle();
  if (!script) notFound();

  const [{ data: shots }, { data: brief }, { data: comments }] = await Promise.all([
    supabase.from("shots").select("*").eq("script_id", id).order("shot_number"),
    supabase.from("shooting_briefs").select("reference_url, notes, due_date").eq("script_id", id).maybeSingle(),
    supabase
      .from("script_comments")
      .select("id, body, kind, created_at, author_id")
      .eq("script_id", id)
      .order("created_at"),
  ]);

  const spoken = [script.hook, script.body].filter((part) => part.trim()).join("\n\n");
  const waitingForApproval = script.stage === "sent_to_client";

  return (
    <div className="space-y-5">
      <header>
        <Link href="/portal" className="text-sm text-ink-2">
          ← To do
        </Link>
        <h1 className="mt-1 font-display text-3xl text-ink">{script.title}</h1>
      </header>

      {waitingForApproval && (
        <Card className="border-gold">
          <CardTitle>Does this sound like you?</CardTitle>
          <p className="mb-4 text-sm text-ink-2">
            Read it through below. If it sounds like you, approve it and your upload slots open. If not, tell us what
            to change.
          </p>
          <ActionForm action={approveScript}>
            <input type="hidden" name="script_id" value={script.id} />
            <SubmitButton pendingLabel="Approving…" className="w-full">
              Approve this script
            </SubmitButton>
          </ActionForm>
          <details className="mt-4">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink">
              I would like changes
            </summary>
            <ActionForm action={requestChanges} className="mt-2">
              <input type="hidden" name="script_id" value={script.id} />
              <Field label="What should we change?">
                <Textarea name="comment" required placeholder="I would never open with a question. Start with the story." />
              </Field>
              <div className="mt-3">
                <SubmitButton variant="secondary" pendingLabel="Sending…">
                  Send back for changes
                </SubmitButton>
              </div>
            </ActionForm>
          </details>
        </Card>
      )}

      <Card className="p-0">
        <div className="px-5 pt-5">
          <CardTitle>Teleprompter</CardTitle>
          <p className="-mt-2 mb-3 text-sm text-ink-2">
            Tap the text to start and pause. Use full screen while you record.
          </p>
        </div>
        <Teleprompter text={spoken} className="rounded-t-none" />
      </Card>

      <Card>
        <CardTitle>Shooting brief</CardTitle>
        {brief?.due_date && (
          <p className="mb-3 text-sm">
            <Badge tone="warning">Footage due {formatDate(brief.due_date)}</Badge>
          </p>
        )}
        {brief?.notes && <p className="mb-4 whitespace-pre-wrap text-sm text-ink">{brief.notes}</p>}
        {brief?.reference_url && (
          <p className="mb-4 text-sm">
            <a
              href={brief.reference_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gold underline"
            >
              Watch the example video
            </a>
          </p>
        )}
        <ol className="space-y-4">
          {shots?.map((shot) => (
            <li key={shot.id} className="rounded-lg border border-line p-4" data-testid="portal-shot">
              <p className="font-semibold text-ink">
                Shot {shot.shot_number}
                {shot.instruction ? `: ${shot.instruction}` : ""}
              </p>
              {shot.lines && <p className="mt-2 whitespace-pre-wrap text-ink">“{shot.lines}”</p>}
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-ink-3">Hold phone</dt>
                <dd className="capitalize">{shot.orientation === "portrait" ? "Upright (portrait)" : "Sideways (landscape)"}</dd>
                <dt className="text-ink-3">Length</dt>
                <dd>At least {shot.min_duration_seconds} seconds</dd>
                {shot.framing && (
                  <>
                    <dt className="text-ink-3">Framing</dt>
                    <dd>{shot.framing}</dd>
                  </>
                )}
                {shot.where_to_look && (
                  <>
                    <dt className="text-ink-3">Look</dt>
                    <dd>{shot.where_to_look}</dd>
                  </>
                )}
                {shot.lighting_notes && (
                  <>
                    <dt className="text-ink-3">Lighting</dt>
                    <dd>{shot.lighting_notes}</dd>
                  </>
                )}
              </dl>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardTitle>Where this video is</CardTitle>
        <StageChecklist stage={script.stage} />
      </Card>

      <Card>
        <CardTitle>Questions or comments</CardTitle>
        {comments?.length ? (
          <ul className="mb-4 space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <p className="whitespace-pre-wrap text-ink">{c.body}</p>
                <p className="mt-1 text-xs text-ink-3">{formatDateTime(c.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <ActionForm action={addClientComment} resetOnSuccess>
          <input type="hidden" name="script_id" value={script.id} />
          <Textarea name="body" required className="min-h-20" placeholder="Ask the team anything about this script" />
          <div className="mt-3">
            <SubmitButton variant="secondary" pendingLabel="Sending…">
              Send
            </SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
