import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/forms";
import { BUCKETS, SIGNED_URL_SECONDS } from "@/lib/storage";

/**
 * Link to a job's submitted cut (before it is delivered). For the team
 * reviewing it and the editor who made it; row level security hides the job
 * from everyone else, including the client.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/media/cut/[id]">) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  if (user.role === "client") return new Response("Not found.", { status: 404 });
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found.", { status: 404 });

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("edit_jobs")
    .select("id, client_id, deliverable_path, deliverable_alt_path")
    .eq("id", id)
    .maybeSingle();
  const alt = new URL(request.url).searchParams.get("v") === "alt";
  const path = alt ? job?.deliverable_alt_path : job?.deliverable_path;
  if (!job || !path) return new Response("Not found.", { status: 404 });

  const { data: signed } = await supabase.storage.from(BUCKETS.deliverables).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (!signed?.signedUrl) return new Response("Not found.", { status: 404 });

  await supabase.rpc("log_event", {
    p_client_id: job.client_id,
    p_table: "edit_jobs",
    p_record_id: job.id,
    p_action: alt ? "cut_alt_view_link" : "cut_view_link",
  });
  return new Response(null, { status: 302, headers: { Location: signed.signedUrl, "Cache-Control": "no-store" } });
}
