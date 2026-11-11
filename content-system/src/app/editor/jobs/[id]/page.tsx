import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireEditor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/action-form";
import { DownloadAll } from "@/components/download-all";
import { JobThread, type ThreadMessage } from "@/components/job-thread";
import { Badge, Card, CardTitle, PageHeader, buttonClass } from "@/components/ui";
import { startJob } from "@/app/actions/jobs";
import { FORMATS, JOB_STATUS, formatDate, isOverdue, one } from "@/lib/labels";
import { isUuid } from "@/lib/forms";
import { formatBytes } from "@/lib/storage";
import { SubmitCut } from "./submit-cut";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditorJobPage({ params }: PageProps<"/editor/jobs/[id]">) {
  await requireEditor();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  // Everything below is filtered by row level security to this editor's own job.
  const supabase = await createClient();
  const { data: job } = await supabase.from("edit_jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();

  const [{ data: script }, { data: shots }, { data: clips }, { data: messages }] = await Promise.all([
    supabase.from("scripts").select("title, hook, body, format").eq("id", job.script_id).maybeSingle(),
    supabase.from("shots").select("id, shot_number, instruction, lines").eq("script_id", job.script_id).order("shot_number"),
    supabase
      .from("footage_uploads")
      .select("id, shot_number, original_name, size_bytes, duration_seconds")
      .eq("script_id", job.script_id)
      .eq("superseded", false)
      .eq("check_status", "passed")
      .order("shot_number"),
    supabase
      .from("job_messages")
      .select("id, kind, body, created_at, author:profiles!job_messages_author_id_fkey(full_name, role)")
      .eq("job_id", id)
      .order("created_at"),
  ]);

  const status = JOB_STATUS[job.status];
  const open = job.status === "queued" || job.status === "in_progress" || job.status === "revision";
  const thread: ThreadMessage[] = (messages ?? []).map((m) => ({ ...m, author: one(m.author) }));

  return (
    <>
      <PageHeader
        title={script?.title ?? "Edit job"}
        subtitle={
          <>
            {job.client_label}
            {job.due_date && (
              <span className={isOverdue(job.due_date) && job.status !== "done" ? "font-semibold text-danger" : ""}>
                {" "}
                · due {formatDate(job.due_date)}
              </span>
            )}
            {job.revision_count > 0 && ` · revision ${job.revision_count}`}
          </>
        }
        back={{ href: "/editor", label: "My jobs" }}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      <div className="space-y-5">
        {(job.status === "queued" || job.status === "revision") && (
          <Card className="border-gold">
            <p className="mb-3 text-sm text-ink">
              {job.status === "revision"
                ? "The team asked for changes. Their note is in the thread below."
                : "This job is waiting for you."}
            </p>
            <form action={startJob}>
              <input type="hidden" name="job_id" value={job.id} />
              <SubmitButton pendingLabel="Starting…">
                {job.status === "revision" ? "Start the revision" : "Start this job"}
              </SubmitButton>
            </form>
          </Card>
        )}
        {job.status === "submitted" && (
          <Card className="border-success">
            <p className="font-semibold text-success">Submitted. Waiting for the team to review.</p>
            <p className="mt-2">
              <a href={`/api/media/cut/${job.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-gold underline">
                Watch the cut you sent
              </a>
            </p>
          </Card>
        )}
        {job.status === "done" && (
          <Card>
            <p className="text-sm text-ink-2">This job is finished. The footage is no longer available to you.</p>
          </Card>
        )}

        {job.style_notes && (
          <Card>
            <CardTitle>Style notes</CardTitle>
            <p className="whitespace-pre-wrap text-ink">{job.style_notes}</p>
          </Card>
        )}

        {script && (
          <Card>
            <CardTitle action={<Badge>{FORMATS[script.format]}</Badge>}>Script</CardTitle>
            {script.hook && <p className="mb-3 font-semibold text-ink">{script.hook}</p>}
            <p className="whitespace-pre-wrap text-ink">{script.body}</p>
          </Card>
        )}

        {job.status !== "done" && (
          <Card>
            <CardTitle
              action={<DownloadAll urls={(clips ?? []).map((c) => `/api/media/footage/${c.id}?download=1`)} />}
            >
              Raw footage
            </CardTitle>
            <p className="mb-4 text-sm text-ink-2">Download links are private, expire after 15 minutes, and are logged.</p>
            <ol className="space-y-3">
              {shots?.map((shot) => {
                const clip = clips?.find((c) => c.shot_number === shot.shot_number);
                return (
                  <li key={shot.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-semibold text-ink">
                        Shot {shot.shot_number}
                        {shot.instruction ? `: ${shot.instruction}` : ""}
                      </span>
                      {shot.lines && <span className="block whitespace-pre-wrap text-ink-2">“{shot.lines}”</span>}
                      {clip && (
                        <span className="text-ink-3">
                          {formatBytes(clip.size_bytes)}
                          {clip.duration_seconds != null && ` · ${Math.round(clip.duration_seconds)}s`}
                        </span>
                      )}
                    </span>
                    {clip ? (
                      <a href={`/api/media/footage/${clip.id}?download=1`} className={buttonClass("secondary")}>
                        Download
                      </a>
                    ) : (
                      <Badge>No clip</Badge>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>
        )}

        {open && (
          <Card>
            <CardTitle>Submit your cut</CardTitle>
            <SubmitCut jobId={job.id} />
          </Card>
        )}

        <Card>
          <CardTitle action={job.revision_count > 0 ? <Badge tone="warning">{job.revision_count} revision{job.revision_count > 1 ? "s" : ""}</Badge> : undefined}>
            Job thread
          </CardTitle>
          <JobThread jobId={job.id} messages={thread} canPost={job.status !== "done"} />
        </Card>
      </div>
    </>
  );
}
