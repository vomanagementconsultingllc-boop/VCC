import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/forms";
import { BUCKETS, SIGNED_URL_SECONDS } from "@/lib/storage";

/**
 * Hand out a link to one raw clip. Every click issues a fresh signed URL that
 * expires in 15 minutes, and is written to the audit log. Both lookups run as
 * the signed-in user, so row level security decides whether the clip exists
 * for them at all.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/media/footage/[id]">) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found.", { status: 404 });

  const supabase = await createClient();
  const { data: upload } = await supabase
    .from("footage_uploads")
    .select("id, client_id, storage_path, original_name, shot_number")
    .eq("id", id)
    .maybeSingle();
  if (!upload) return new Response("Not found.", { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  const ext = upload.storage_path.split(".").pop() ?? "mp4";
  const { data: signed, error } = await supabase.storage
    .from(BUCKETS.footage)
    .createSignedUrl(upload.storage_path, SIGNED_URL_SECONDS, {
      download: download ? `shot-${upload.shot_number}.${ext}` : false,
    });
  if (error || !signed?.signedUrl) return new Response("Not found.", { status: 404 });

  await supabase.rpc("log_event", {
    p_client_id: upload.client_id,
    p_table: "footage_uploads",
    p_record_id: upload.id,
    p_action: download ? "download_link" : "view_link",
  });

  return new Response(null, {
    status: 302,
    headers: { Location: signed.signedUrl, "Cache-Control": "no-store" },
  });
}
