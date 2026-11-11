import type { Metadata } from "next";
import Link from "next/link";
import { requireEditor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { JOB_STATUS, formatDate, isOverdue, one } from "@/lib/labels";

export const metadata: Metadata = { title: "My jobs" };

export default async function EditorHome() {
  await requireEditor();
  const supabase = await createClient();
  // Row level security returns only the jobs assigned to this editor.
  const { data: jobs } = await supabase
    .from("edit_jobs")
    .select("id, status, due_date, client_label, revision_count, script:scripts(title)")
    .order("due_date", { ascending: true, nullsFirst: false });

  const open = (jobs ?? []).filter((j) => j.status !== "done");
  const done = (jobs ?? []).filter((j) => j.status === "done");

  return (
    <>
      <PageHeader title="My jobs" subtitle="Only jobs assigned to you appear here." />
      {open.length === 0 ? (
        <EmptyState title="No open jobs">New jobs show up here and arrive by email.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {open.map((job) => (
            <li key={job.id}>
              <Link
                href={`/editor/jobs/${job.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-gold"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{one(job.script)?.title ?? "Edit job"}</span>
                  <span className="text-sm text-ink-2">
                    {job.client_label}
                    {job.due_date && (
                      <span className={isOverdue(job.due_date) ? "font-semibold text-danger" : ""}>
                        {" "}
                        · due {formatDate(job.due_date)}
                      </span>
                    )}
                    {job.revision_count > 0 && ` · revision ${job.revision_count}`}
                  </span>
                </span>
                <Badge tone={JOB_STATUS[job.status].tone}>{JOB_STATUS[job.status].label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-2">Finished</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {done.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-ink">{job.client_label}</span>
                <Badge tone="success">Done</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
