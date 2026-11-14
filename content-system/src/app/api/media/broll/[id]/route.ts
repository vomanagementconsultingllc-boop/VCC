import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/forms";
import { BUCKETS, SIGNED_URL_SECONDS } from "@/lib/storage";

/** Link to one b-roll clip: a fresh 15-minute signed URL per click, logged. Row level security decides who can ask. */
export async function GET(request: Request, { params }: RouteContext<"/api/media/broll/[id]">) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found.", { status: 404 });

  const supabase = await createClient();
  const { data: clip } = await supabase
    .from("broll_submissions")
    .select("id, client_id, storage_path, original_name")
    .eq("id", id)
    .maybeSingle();
  if (!clip) return new Response("Not found.", { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  const ext = clip.storage_path.split(".").pop() ?? "mp4";
  const { data: signed } = await supabase.storage.from(BUCKETS.broll).createSignedUrl(clip.storage_path, SIGNED_URL_SECONDS, {
    download: download ? `broll-${clip.id.slice(0, 8)}.${ext}` : false,
  });
  if (!signed?.signedUrl) return new Response("Not found.", { status: 404 });

  await supabase.rpc("log_event", {
    p_client_id: clip.client_id,
    p_table: "broll_submissions",
    p_record_id: clip.id,
    p_action: download ? "download_link" : "view_link",
  });
  return new Response(null, { status: 302, headers: { Location: signed.signedUrl, "Cache-Control": "no-store" } });
}
