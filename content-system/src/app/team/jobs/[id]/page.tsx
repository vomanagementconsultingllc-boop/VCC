import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { JobThread, type ThreadMessage } from "@/components/job-thread";
import { Badge, Card, CardTitle, Field, Input, PageHeader, Select, Textarea, buttonClass } from "@/components/ui";
import { approveCut, requestRevision, saveJobCost, updateJob } from "@/app/actions/jobs";
import { JOB_STATUS, formatDateTime, one } from "@/lib/labels";
import { centsToDollars, isUuid } from "@/lib/forms";

export const metadata: Metadata = { title: "Edit job" };

export default async function TeamJobPage({ params }: PageProps<"/team/jobs/[id]">) {
  const user = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: job } = await supabase.from("edit_jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();

  const [{ data: script }, { data: editors }, { data: messages }, { data: settings }, { data: cost }, { data: deliverable }] =
    await Promise.all([
      supabase.from("scripts").select("id, title, hook").eq("id", job.script_id).maybeSingle(),
      supabase.from("profiles").select("id, full_name, email").eq("role", "editor").order("full_name"),
      supabase
        .from("job_messages")
        .select("id, kind, body, created_at, author:profiles!job_messages_author_id_fkey(full_name, role)")
        .eq("job_id", id)
        .order("created_at"),
      supabase.from("app_settings").select("revision_allowance").maybeSingle(),
      // Row level security returns nothing here for team members.
      supabase.from("edit_job_costs").select("cost_cents").eq("job_id", id).maybeSingle(),
      supabase.from("deliverables").select("id, delivered_at, client_downloaded_at, caption_draft").eq("edit_job_id", id).maybeSingle(),
    ]);

  const status = JOB_STATUS[job.status];
  const allowance = settings?.revision_allowance ?? null;
  const over = allowance != null && job.revision_count > allowance;
  const nextIsOver = allowance != null && job.revision_count + 1 > allowance;
  const thread: ThreadMessage[] = (messages ?? []).map((m) => ({ ...m, author: one(m.author) }));

  return (
    <>
      <PageHeader
        title={script?.title ?? "Edit job"}
        subtitle={
          <>
            {job.client_label} ·{" "}
            <Link href={`/team/scripts/${job.script_id}`} className="font-semibold text-gold">
              Script and footage
            </Link>
          </>
        }
        back={{ href: "/team/jobs", label: "Edit jobs" }}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {job.status === "submitted" && (
            <Card className="border-gold">
              <CardTitle>Review the cut</CardTitle>
              <div className="mb-4 flex flex-wrap gap-2">
                <a href={`/api/media/cut/${job.id}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                  Watch the cut
                </a>
                {job.deliverable_alt_path && (
                  <a href={`/api/media/cut/${job.id}?v=alt`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                    Watch the second version
                  </a>
                )}
              </div>
              {job.editor_notes && (
                <p className="mb-4 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">
                  <span className="font-semibold">Editor: </span>
                  {job.editor_notes}
                </p>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <ActionForm action={approveCut}>
                  <input type="hidden" name="job_id" value={job.id} />
                  <Field label="Caption draft for the client" hint="They get this with the video and a posting checklist.">
                    <Textarea name="caption" rows={5} defaultValue={script?.hook ?? ""} />
                  </Field>
                  <div className="mt-3">
                    <SubmitButton pendingLabel="Delivering…" confirm="Approve this cut and deliver it to the client?">
                      Approve and deliver
                    </SubmitButton>
                  </div>
                </ActionForm>
                <ActionForm action={requestRevision}>
                  <input type="hidden" name="job_id" value={job.id} />
                  <Field
                    label="Or send a revision note"
                    hint={
                      nextIsOver
                        ? `This would be revision ${job.revision_count + 1}, past the ${allowance} included.`
                        : allowance != null
                          ? `Revision ${job.revision_count + 1} of ${allowance} included.`
                          : undefined
                    }
                  >
                    <Textarea name="note" rows={5} required placeholder="Tighten the first three seconds. Captions are covering her face." />
                  </Field>
                  <div className="mt-3">
                    <SubmitButton variant="secondary" pendingLabel="Sending…">
                      Request revision
                    </SubmitButton>
                  </div>
                </ActionForm>
              </div>
            </Card>
          )}

          {deliverable && (
            <Card className="border-success">
              <CardTitle>Delivered</CardTitle>
              <p className="text-sm text-ink-2">
                Delivered {formatDateTime(deliverable.delivered_at)}.{" "}
                {deliverable.client_downloaded_at
                  ? `Client downloaded it ${formatDateTime(deliverable.client_downloaded_at)}.`
                  : "The client has not downloaded it yet."}
              </p>
              <p className="mt-3">
                <a href={`/api/media/deliverable/${deliverable.id}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                  Watch the delivered video
                </a>
              </p>
            </Card>
          )}

          <Card>
            <CardTitle
              action={
                <Badge tone={over ? "danger" : job.revision_count > 0 ? "warning" : "neutral"}>
                  {job.revision_count}
                  {allowance != null ? ` of ${allowance}` : ""} revision{job.revision_count === 1 && allowance == null ? "" : "s"}
                  {over ? " · over" : ""}
                </Badge>
              }
            >
              Job thread
            </CardTitle>
            <JobThread jobId={job.id} messages={thread} canPost />
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardTitle>Assignment</CardTitle>
            <ActionForm action={updateJob} className="space-y-3">
              <input type="hidden" name="job_id" value={job.id} />
              <Field label="Editor">
                <Select name="editor_id" defaultValue={job.editor_id ?? ""}>
                  <option value="">Unassigned (queue)</option>
                  {editors?.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name || e.email}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Due">
                <Input type="date" name="due_date" defaultValue={job.due_date ?? ""} />
              </Field>
              <Field label="Style notes" hint="The editor sees these with the footage.">
                <Textarea name="style_notes" defaultValue={job.style_notes} />
              </Field>
              <SubmitButton variant="secondary">Save</SubmitButton>
            </ActionForm>
          </Card>

          {user.role === "admin" && (
            <Card>
              <CardTitle>Cost</CardTitle>
              <ActionForm action={saveJobCost} className="space-y-3">
                <input type="hidden" name="job_id" value={job.id} />
                <Field label="Edit cost (USD)" hint="Admin only. Feeds the margin per client.">
                  <Input name="cost" inputMode="decimal" defaultValue={centsToDollars(cost?.cost_cents)} />
                </Field>
                <SubmitButton variant="secondary">Save cost</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
