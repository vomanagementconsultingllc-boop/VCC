import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/forms";
import { BUCKETS, SIGNED_URL_SECONDS } from "@/lib/storage";

/**
 * Link to a delivered video. For the client it belongs to and the team. A
 * client download is recorded on the deliverable (client_downloaded_at).
 */
export async function GET(request: Request, { params }: RouteContext<"/api/media/deliverable/[id]">) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found.", { status: 404 });

  const supabase = await createClient();
  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, client_id, file_path, alt_file_path, script_id")
    .eq("id", id)
    .maybeSingle();
  const query = new URL(request.url).searchParams;
  const alt = query.get("v") === "alt";
  const path = alt ? deliverable?.alt_file_path : deliverable?.file_path;
  if (!deliverable || !path) return new Response("Not found.", { status: 404 });

  const download = query.has("download");
  const ext = path.split(".").pop() ?? "mp4";
  const { data: signed } = await supabase.storage.from(BUCKETS.deliverables).createSignedUrl(path, SIGNED_URL_SECONDS, {
    download: download ? `vo-creative-video${alt ? "-v2" : ""}.${ext}` : false,
  });
  if (!signed?.signedUrl) return new Response("Not found.", { status: 404 });

  if (user.role === "client" && download) {
    await supabase.rpc("client_mark_downloaded", { p_deliverable_id: deliverable.id });
  }
  await supabase.rpc("log_event", {
    p_client_id: deliverable.client_id,
    p_table: "deliverables",
    p_record_id: deliverable.id,
    p_action: download ? "download_link" : "view_link",
  });
  return new Response(null, { status: 302, headers: { Location: signed.signedUrl, "Cache-Control": "no-store" } });
}
