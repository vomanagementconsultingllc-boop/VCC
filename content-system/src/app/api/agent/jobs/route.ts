import { editorFromRequest } from "@/lib/agent-auth";
import { one } from "@/lib/labels";

/** GET /api/agent/jobs: the open jobs assigned to this editor seat. */
export async function GET(request: Request) {
  const session = await editorFromRequest(request);
  if (session instanceof Response) return session;

  const { data, error } = await session.supabase
    .from("edit_jobs")
    .select("id, status, due_date, revision_count, client_label, script:scripts(title)")
    .neq("status", "done")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) return Response.json({ error: "Could not list jobs." }, { status: 500 });

  return Response.json({
    jobs: (data ?? []).map((job) => ({
      id: job.id,
      status: job.status,
      due_date: job.due_date,
      revision_count: job.revision_count,
      client_label: job.client_label,
      title: one(job.script)?.title ?? null,
    })),
  });
}
