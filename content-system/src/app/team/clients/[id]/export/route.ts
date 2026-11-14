import { getSessionUser } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { exportClient } from "@/lib/offboarding";
import { createClient } from "@/lib/supabase/server";

/** Download everything held about one client as JSON. Admin only. */
export async function GET(_request: Request, { params }: RouteContext<"/team/clients/[id]/export">) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return new Response("Not found.", { status: 404 });
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found.", { status: 404 });
  const data = await exportClient(id);
  if (!data) return new Response("Not found.", { status: 404 });

  const supabase = await createClient();
  await supabase.rpc("log_event", { p_client_id: id, p_table: "clients", p_record_id: id, p_action: "exported" });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="client-export-${id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
