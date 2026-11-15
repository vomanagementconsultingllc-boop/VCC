import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardTitle, Field, Select, Textarea } from "@/components/ui";
import { draftWithAi, markReviewed, pickHook } from "../../research/actions";

type HookOption = { id: string | null; text: string | null; score: number | null };

/**
 * Hook picker, AI draft, and the side-by-side: the source outlier's words
 * next to the client's version, so the team can confirm it was adapted and
 * not copied.
 */
export function ResearchCard({
  scriptId,
  isDraft,
  aiReady,
  aiDrafted,
  reviewed,
  hooks,
  source,
  clientVersion,
}: {
  scriptId: string;
  isDraft: boolean;
  aiReady: boolean;
  aiDrafted: boolean;
  reviewed: boolean;
  hooks: HookOption[];
  source: { transcript: string; url: string; handle: string } | null;
  clientVersion: string;
}) {
  return (
    <Card>
      <CardTitle
        action={aiDrafted ? <Badge tone={reviewed ? "success" : "warning"}>{reviewed ? "AI draft, reviewed" : "AI draft, not reviewed"}</Badge> : undefined}
      >
        Hook and draft
      </CardTitle>

      {aiDrafted && !reviewed && (
        <div className="mb-4 rounded-2xl bg-warning-soft px-3 py-2 text-sm text-ink">
          <p>This draft was written by AI. It cannot be sent to the client until someone on the team has read it.</p>
          <form action={markReviewed} className="mt-2">
            <input type="hidden" name="script_id" value={scriptId} />
            <SubmitButton variant="secondary" confirm="Confirm you have read and edited this draft?">
              I have read and edited it
            </SubmitButton>
          </form>
        </div>
      )}

      {isDraft && hooks.length > 0 && (
        <form action={pickHook} className="mb-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="script_id" value={scriptId} />
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-sm font-semibold">Pick a proven hook for this niche</span>
            <Select name="hook_id" defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {hooks.map((h) => (
                <option key={h.id} value={h.id ?? ""}>
                  {Number(h.score ?? 0)} · {h.text}
                </option>
              ))}
            </Select>
          </label>
          <SubmitButton variant="secondary">Use this hook</SubmitButton>
        </form>
      )}

      {isDraft && (
        <ActionForm action={draftWithAi}>
          <input type="hidden" name="script_id" value={scriptId} />
          <Field
            label="Brief for the draft (optional)"
            hint={
              aiReady
                ? "Sends the hook, format, phrase bank, never-say list, their offer and up to three of their posts. Replaces the current words."
                : "AI drafting is off until ANTHROPIC_API_KEY is set."
            }
          >
            <Textarea name="brief" className="min-h-16" placeholder="Make it about the back-to-school rush. End by inviting questions." />
          </Field>
          <div className="mt-3">
            <SubmitButton pendingLabel="Writing… up to a minute" confirm="Draft with AI? This replaces the hook and script text.">
              Draft with AI
            </SubmitButton>
          </div>
        </ActionForm>
      )}

      {source && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-2 text-sm font-semibold text-ink">Adapted, not copied?</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
                Source{source.handle && ` · @${source.handle}`}
              </p>
              <p className="whitespace-pre-wrap text-sm text-ink-2">{source.transcript || "No transcript saved for the source."}</p>
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-gold-hover underline">
                Watch the source
              </a>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">This client&rsquo;s version (last saved)</p>
              <p className="whitespace-pre-wrap text-sm text-ink">{clientVersion || "Nothing written yet."}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
