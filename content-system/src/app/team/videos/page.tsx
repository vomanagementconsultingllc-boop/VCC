import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink, PageHeader, Select, buttonClass } from "@/components/ui";
import { VideoBoard } from "@/components/team/video-board";
import { one } from "@/lib/labels";
import { footageIsLate } from "@/lib/pipeline-health";
import { isUuid } from "@/lib/forms";

export const metadata: Metadata = { title: "Videos" };

/** Every video in progress, grouped by the same three steps the client sees. */
export default async function VideosPage({ searchParams }: PageProps<"/team/videos">) {
  await requireStaff();
  const params = await searchParams;
  const clientFilter = typeof params.client === "string" && isUuid(params.client) ? params.client : "";

  const supabase = await createClient();
  let query = supabase
    .from("scripts")
    .select("id, title, stage, footage_requested_at, client:clients(name, business), brief:shooting_briefs(due_date)")
    .order("updated_at", { ascending: false });
  if (clientFilter) query = query.eq("client_id", clientFilter);

  const [{ data: scripts }, { data: clients }, { data: submitted }] = await Promise.all([
    query,
    supabase.from("clients").select("id, name, business").neq("status", "offboarded").order("business"),
    supabase.from("edit_jobs").select("id, script_id").eq("status", "submitted"),
  ]);
  const jobByScript = new Map((submitted ?? []).map((j) => [j.script_id, j.id]));
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Videos"
        subtitle="Every video in progress, in the three steps your clients see. The ones waiting on you are at the top of each step."
        actions={
          <>
            <form className="flex items-center gap-2">
              <Select name="client" defaultValue={clientFilter} aria-label="Show one client" className="min-w-44">
                <option value="">All clients</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.business || c.name}
                  </option>
                ))}
              </Select>
              <button type="submit" className={buttonClass("secondary")}>
                Show
              </button>
            </form>
            <ButtonLink href="/team/jobs" variant="secondary">
              Editing queue
            </ButtonLink>
          </>
        }
      />
      <VideoBoard
        videos={(scripts ?? []).map((s) => {
          const client = one(s.client);
          const jobId = jobByScript.get(s.id);
          return {
            id: s.id,
            title: s.title,
            stage: s.stage,
            client: client?.business || client?.name || "",
            // Straight to where the next thing gets done.
            href:
              s.stage === "review" && jobId
                ? `/team/jobs/${jobId}`
                : s.stage === "footage_received"
                  ? "/team/jobs"
                  : `/team/scripts/${s.id}`,
            late: footageIsLate(s, now),
            dueDate: one(s.brief)?.due_date ?? null,
          };
        })}
      />
      <Link href="/team/performance" className="mt-6 inline-block text-sm font-semibold text-ink-2 hover:text-ink">
        What has gone out so far, by client →
      </Link>
    </>
  );
}
