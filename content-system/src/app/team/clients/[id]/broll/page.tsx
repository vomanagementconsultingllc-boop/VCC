import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardTitle, Field, Input, PageHeader, Select, Textarea, buttonClass, type Tone } from "@/components/ui";
import { deleteBrollRequest, rerunBrollReview, reviewBrollByTeam, saveBrollRequest } from "@/app/actions/broll";
import { aiConfigured } from "@/lib/ai/client";
import { formatDate, formatDateTime } from "@/lib/labels";
import { isUuid } from "@/lib/forms";
import { formatBytes } from "@/lib/storage";
import type { Database } from "@/lib/database.types";
import { ClientTabs } from "../client-tabs";

export const metadata: Metadata = { title: "B-roll drop box" };

type Request = Database["public"]["Tables"]["broll_requests"]["Row"];

const STATUS: Record<Request["status"], { label: string; tone: Tone }> = {
  open: { label: "Waiting on client", tone: "warning" },
  submitted: { label: "Needs your review", tone: "info" },
  needs_reshoot: { label: "Sent back for another take", tone: "danger" },
  accepted: { label: "Accepted", tone: "success" },
};
const REVIEWER: Record<string, string> = { ai: "AI review", auto: "Automatic check", team: "Team" };

function RequestFields({ request }: { request?: Request }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="What to shoot" className="sm:col-span-2">
        <Input name="title" required defaultValue={request?.title} placeholder="Your hands shaping a loaf on the bench" />
      </Field>
      <Field label="How to shoot it" hint="Shown to the client word for word. Where to stand, how to hold the phone, how long." className="sm:col-span-2">
        <Textarea
          name="instructions"
          defaultValue={request?.instructions}
          placeholder="Hold the phone upright at chest height, close enough that your hands fill the frame. Stand so the window light falls on the bench. Keep still for 10 seconds."
        />
      </Field>
      <Field label="Hold phone">
        <Select name="orientation" defaultValue={request?.orientation ?? "portrait"}>
          <option value="portrait">Upright (portrait)</option>
          <option value="landscape">Sideways (landscape)</option>
        </Select>
      </Field>
      <Field label="Minimum seconds">
        <Input name="min_duration_seconds" type="number" min={0} max={600} defaultValue={request?.min_duration_seconds ?? 8} />
      </Field>
      <Field label="Example link (optional)">
        <Input name="reference_url" type="url" defaultValue={request?.reference_url} placeholder="https://" />
      </Field>
      <Field label="Due (optional)">
        <Input name="due_date" type="date" defaultValue={request?.due_date ?? ""} />
      </Field>
    </div>
  );
}

export default async function ClientBrollPage({ params }: PageProps<"/team/clients/[id]/broll">) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: client }, { data: requests }, { data: submissions }] = await Promise.all([
    supabase.from("clients").select("id, name, business").eq("id", id).maybeSingle(),
    supabase.from("broll_requests").select("*").eq("client_id", id).order("sort_order").order("created_at"),
    supabase.from("broll_submissions").select("*").eq("client_id", id).order("uploaded_at", { ascending: false }),
  ]);
  if (!client) notFound();
  const ai = aiConfigured();

  return (
    <>
      <PageHeader
        title={client.business || client.name}
        subtitle="B-roll drop box: what this client should film, and what they have sent."
        back={{ href: "/team", label: "Clients" }}
      />
      <ClientTabs clientId={client.id} />

      {!ai && (
        <p className="mb-5 rounded-lg bg-warning-soft px-4 py-3 text-sm text-ink">
          AI review is off (no ANTHROPIC_API_KEY). Clips are still checked for length and orientation, then wait here for
          you to accept or send back.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {!requests?.length && (
            <Card>
              <p className="text-sm text-ink-2">Nothing on the list yet. Add the first clip you want this client to film.</p>
            </Card>
          )}
          {requests?.map((r) => {
            const current = submissions?.find((s) => s.request_id === r.id && !s.superseded);
            const earlier = submissions?.filter((s) => s.request_id === r.id && s.superseded).length ?? 0;
            return (
              <Card key={r.id}>
                <CardTitle action={<Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>}>{r.title}</CardTitle>
                {r.instructions && <p className="mb-3 whitespace-pre-wrap text-sm text-ink-2">{r.instructions}</p>}
                <p className="mb-4 text-xs text-ink-3">
                  {r.orientation === "portrait" ? "Upright" : "Sideways"} · at least {r.min_duration_seconds}s
                  {r.due_date && ` · due ${formatDate(r.due_date)}`}
                </p>

                {current ? (
                  <div className="rounded-lg bg-surface-2 p-3 text-sm">
                    <p className="text-ink-2">
                      {current.original_name || "clip"} · {formatBytes(current.size_bytes)}
                      {current.duration_seconds != null && ` · ${Math.round(current.duration_seconds)}s`}
                      {current.width && current.height ? ` · ${current.width}×${current.height}` : ""} · sent{" "}
                      {formatDateTime(current.uploaded_at)}
                      {earlier > 0 && ` · ${earlier} earlier take${earlier > 1 ? "s" : ""}`}
                    </p>
                    {current.reviewed_by && (
                      <p className="mt-1 text-ink">
                        <strong>{REVIEWER[current.reviewed_by] ?? "Review"}:</strong>{" "}
                        {current.check_status === "passed" ? "usable." : current.feedback || "not usable."}
                        {current.flags.length > 0 && <span className="text-ink-3"> ({current.flags.join(", ")})</span>}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a href={`/api/media/broll/${current.id}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                        Watch clip
                      </a>
                      {current.check_status === "pending" && ai && (
                        <form action={rerunBrollReview}>
                          <input type="hidden" name="submission_id" value={current.id} />
                          <SubmitButton variant="ghost" pendingLabel="Reviewing…">
                            Run review now
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                    <ActionForm action={reviewBrollByTeam} className="mt-3 border-t border-line pt-3">
                      <input type="hidden" name="submission_id" value={current.id} />
                      <Field label="Your call" hint="Overrules the automatic review either way. Advice is shown to the client.">
                        <Textarea name="advice" className="min-h-16" placeholder="Advice if you are sending it back" />
                      </Field>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {current.check_status !== "passed" && (
                          <button type="submit" name="verdict" value="accept" className={buttonClass("primary")}>
                            Accept this clip
                          </button>
                        )}
                        <button type="submit" name="verdict" value="reshoot" className={buttonClass("secondary")}>
                          Send back with advice
                        </button>
                      </div>
                    </ActionForm>
                  </div>
                ) : (
                  <p className="text-sm text-ink-2">Nothing sent yet.</p>
                )}

                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">Edit or remove</summary>
                  <ActionForm action={saveBrollRequest} className="mt-3">
                    <input type="hidden" name="client_id" value={client.id} />
                    <input type="hidden" name="request_id" value={r.id} />
                    <RequestFields request={r} />
                    <div className="mt-3">
                      <SubmitButton variant="secondary">Save changes</SubmitButton>
                    </div>
                  </ActionForm>
                  <form action={deleteBrollRequest} className="mt-2">
                    <input type="hidden" name="request_id" value={r.id} />
                    <SubmitButton variant="ghost" pendingLabel="Removing…" confirm="Remove this item and any clips sent for it?">
                      Remove from the list
                    </SubmitButton>
                  </form>
                </details>
              </Card>
            );
          })}
        </div>

        <aside>
          <Card>
            <CardTitle>Add b-roll to film</CardTitle>
            <ActionForm action={saveBrollRequest} resetOnSuccess>
              <input type="hidden" name="client_id" value={client.id} />
              <RequestFields />
              <div className="mt-4">
                <SubmitButton pendingLabel="Adding…">Add to their drop box</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        </aside>
      </div>
    </>
  );
}
