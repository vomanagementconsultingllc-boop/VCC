import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardTitle, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { createJob } from "@/app/actions/jobs";
import { JOB_STATUS, formatDate, isOverdue, one, type JobStatus } from "@/lib/labels";

export const metadata: Metadata = { title: "Edit jobs" };

const ORDER: JobStatus[] = ["submitted", "revision", "in_progress", "queued", "done"];

export default async function JobsPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: ready }, { data: jobs }, { data: editors }, { data: settings }] = await Promise.all([
    supabase
      .from("scripts")
      .select("id, title, footage_received_at, client:clients(name, business)")
      .eq("stage", "footage_received")
      .order("footage_received_at"),
    supabase
      .from("edit_jobs")
      .select(
        "id, status, due_date, revision_count, client_label, updated_at, script:scripts(title), editor:profiles!edit_jobs_editor_id_fkey(full_name, email)",
      )
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("id, full_name, email").eq("role", "editor").order("full_name"),
    supabase.from("app_settings").select("revision_allowance").maybeSingle(),
  ]);
  const allowance = settings?.revision_allowance ?? null;
  const sorted = [...(jobs ?? [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));

  return (
    <>
      <PageHeader title="Edit jobs" subtitle="Assign footage to editors and review what comes back." />

      <Card className="mb-5">
        <CardTitle>Ready to assign</CardTitle>
        {!ready?.length ? (
          <p className="text-sm text-ink-2">Nothing waiting. Scripts appear here once every shot has passed its checks.</p>
        ) : (
          <ul className="space-y-4">
            {ready.map((script) => {
              const client = one(script.client);
              return (
                <li key={script.id} className="rounded-lg border border-line p-4">
                  <p className="font-semibold text-ink">
                    <Link href={`/team/scripts/${script.id}`} className="hover:text-gold">
                      {script.title}
                    </Link>
                  </p>
                  <p className="mb-3 text-sm text-ink-2">
                    {client?.business || client?.name} · footage in {formatDate(script.footage_received_at)}
                  </p>
                  <ActionForm action={createJob} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="script_id" value={script.id} />
                    <label className="block">
                      <span className="mb-1 block text-sm font-semibold">Editor</span>
                      <Select name="editor_id" className="min-w-48" defaultValue="">
                        <option value="">Unassigned (queue)</option>
                        {editors?.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.full_name || e.email}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-semibold">Due</span>
                      <Input type="date" name="due_date" />
                    </label>
                    <SubmitButton pendingLabel="Creating…">Create edit job</SubmitButton>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {!sorted.length ? (
        <EmptyState title="No edit jobs yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-2">
              <tr>
                <th className="px-4 py-3">Video</th>
                <th className="px-4 py-3">Editor</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Revisions</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((job) => {
                const editor = one(job.editor);
                const over = allowance != null && job.revision_count > allowance;
                return (
                  <tr key={job.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/team/jobs/${job.id}`} className="font-semibold text-ink hover:text-gold">
                        {one(job.script)?.title ?? "Edit job"}
                      </Link>
                      <span className="block text-ink-2">{job.client_label}</span>
                    </td>
                    <td className="px-4 py-3">{editor ? editor.full_name || editor.email : <Badge tone="warning">Unassigned</Badge>}</td>
                    <td className={isOverdue(job.due_date) && job.status !== "done" ? "px-4 py-3 font-semibold text-danger" : "px-4 py-3"}>
                      {job.due_date ? formatDate(job.due_date) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {job.revision_count}
                      {allowance != null && ` of ${allowance}`} {over && <Badge tone="danger">Over</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={JOB_STATUS[job.status].tone}>{JOB_STATUS[job.status].label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
