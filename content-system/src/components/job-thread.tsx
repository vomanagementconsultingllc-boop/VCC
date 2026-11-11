import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Textarea } from "@/components/ui";
import { addJobNote } from "@/app/actions/jobs";
import { formatDateTime } from "@/lib/labels";

export type ThreadMessage = {
  id: string;
  kind: string;
  body: string;
  created_at: string;
  author: { full_name: string; role: string } | null;
};

const KIND: Record<string, { label: string; tone: "warning" | "info" | "success" }> = {
  revision_request: { label: "Revision request", tone: "warning" },
  submission: { label: "Cut submitted", tone: "info" },
  approval: { label: "Approved", tone: "success" },
};

/** Notes, submissions and revision requests on one job, oldest first. */
export function JobThread({ jobId, messages, canPost }: { jobId: string; messages: ThreadMessage[]; canPost: boolean }) {
  return (
    <div>
      {messages.length === 0 ? (
        <p className="mb-4 text-sm text-ink-2">Nothing here yet.</p>
      ) : (
        <ol className="mb-4 space-y-3">
          {messages.map((m) => (
            <li key={m.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                {KIND[m.kind] && <Badge tone={KIND[m.kind].tone}>{KIND[m.kind].label}</Badge>}
                {m.author?.full_name || (m.author?.role === "editor" ? "Editor" : "Team")} · {formatDateTime(m.created_at)}
              </p>
              {m.body && <p className="whitespace-pre-wrap text-ink">{m.body}</p>}
            </li>
          ))}
        </ol>
      )}
      {canPost && (
        <ActionForm action={addJobNote} resetOnSuccess>
          <input type="hidden" name="job_id" value={jobId} />
          <Textarea name="body" required className="min-h-20" placeholder="Add a note to this job" />
          <div className="mt-3">
            <SubmitButton variant="secondary" pendingLabel="Posting…">
              Add note
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
