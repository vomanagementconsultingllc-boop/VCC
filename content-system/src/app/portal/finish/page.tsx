import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { DownloadAll } from "@/components/download-all";
import { Guide } from "@/components/guide";
import { Badge, Eyebrow, Field, Select, Textarea, buttonClass } from "@/components/ui";
import { one } from "@/lib/labels";
import { requireOnboardedClient } from "@/lib/portal";
import { approveVideo, markPosted, requestFix } from "../actions";

export const metadata: Metadata = { title: "Step 3: Finish" };

/** Step 3. Watch the edit, ask for fixes or approve it, then download everything. */
export default async function FinishPage() {
  const { supabase } = await requireOnboardedClient();
  const [{ data: videos }, { data: editing }] = await Promise.all([
    supabase
      .from("deliverables")
      .select("id, caption_draft, client_approved_at, alt_file_path, script:scripts(title, stage, inspo_url)")
      .order("delivered_at", { ascending: false }),
    supabase.from("scripts").select("id, title").in("stage", ["footage_received", "in_edit", "review"]).order("updated_at"),
  ]);

  const toReview = (videos ?? []).filter((v) => !v.client_approved_at);
  const approved = (videos ?? []).filter((v) => v.client_approved_at);

  return (
    <div className="space-y-5">
      <header>
        <Eyebrow>Step 3 of 3</Eyebrow>
        <h1 className="mt-1 font-display text-4xl text-ink">Finish</h1>
      </header>

      {toReview.length > 0 ? (
        <Guide mood="cheer">
          {toReview.length === 1 ? "Your edit is back." : `${toReview.length} edits are back.`} Watch it through. If
          something is off, tell me what and we will fix it. If it is right, approve it and it is yours to download.
        </Guide>
      ) : approved.length > 0 ? (
        <Guide mood="happy">Everything here is approved and ready. Download them all in one go, or one at a time.</Guide>
      ) : (
        <Guide mood="think">
          {(editing ?? []).length > 0
            ? "Your footage is being edited to match the inspiration video. I will email you when it is ready to watch."
            : "Nothing to finish yet. Once you have filmed a video, the edit comes back to you here."}
        </Guide>
      )}

      {toReview.map((video) => {
        const script = one(video.script);
        return (
          <section key={video.id} className="panel border border-ink/15 p-5">
            <Eyebrow className="text-ink-2">Ready for you to watch</Eyebrow>
            <h2 className="mt-1 font-display text-2xl text-ink">{script?.title ?? "Your video"}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`/api/media/deliverable/${video.id}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                Watch the edit
              </a>
              {script?.inspo_url && (
                <a href={script.inspo_url} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost")}>
                  Compare with the inspiration ↗
                </a>
              )}
            </div>
            <ActionForm action={approveVideo} className="mt-4">
              <input type="hidden" name="deliverable_id" value={video.id} />
              <SubmitButton pendingLabel="Approving…" className="w-full">
                Approve it
              </SubmitButton>
            </ActionForm>
            <details className="mt-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-2">
                Something to fix?
              </summary>
              <ActionForm action={requestFix} className="mt-1">
                <input type="hidden" name="deliverable_id" value={video.id} />
                <Field label="What should change?" hint="Be as specific as you can: where in the video, and what you want instead.">
                  <Textarea name="note" required placeholder="At the start the caption covers my face. And cut the bit where I cough." />
                </Field>
                <div className="mt-3">
                  <SubmitButton variant="secondary" pendingLabel="Sending…">
                    Send it back for a fix
                  </SubmitButton>
                </div>
              </ActionForm>
            </details>
          </section>
        );
      })}

      {approved.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Eyebrow className="text-ink-2">Approved</Eyebrow>
            {approved.length > 1 && <DownloadAll urls={approved.map((v) => `/api/media/deliverable/${v.id}?download=1`)} />}
          </div>
          {approved.map((video) => {
            const script = one(video.script);
            return (
              <div key={video.id} className="panel border border-ink/10 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="min-w-0 flex-1 font-display text-xl text-ink">{script?.title ?? "Your video"}</h2>
                  {script?.stage === "posted" ? <Badge>Posted</Badge> : <Badge>Ready to post</Badge>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={`/api/media/deliverable/${video.id}?download=1`} className={buttonClass("primary")}>
                    Download
                  </a>
                  {video.alt_file_path && (
                    <a href={`/api/media/deliverable/${video.id}?download=1&v=alt`} className={buttonClass("secondary")}>
                      Second version
                    </a>
                  )}
                  {video.caption_draft && <CopyButton text={video.caption_draft} />}
                </div>
                {video.caption_draft && <p className="mt-3 whitespace-pre-wrap text-sm text-ink-2">{video.caption_draft}</p>}
                {script?.stage !== "posted" && (
                  <ActionForm action={markPosted} className="mt-4 flex flex-wrap items-end gap-2 border-t border-ink/10 pt-4">
                    <input type="hidden" name="deliverable_id" value={video.id} />
                    <label className="block min-w-0 flex-1">
                      <span className="mb-1.5 block text-sm font-semibold text-ink">Posted it? Tell me where</span>
                      <Select name="platform" defaultValue="instagram">
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="youtube">YouTube</option>
                        <option value="facebook">Facebook</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="other">Somewhere else</option>
                      </Select>
                    </label>
                    <SubmitButton variant="secondary" pendingLabel="Saving…">
                      Mark as posted
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            );
          })}
        </section>
      )}

      {(editing ?? []).length > 0 && (
        <section>
          <Eyebrow className="mb-2 text-ink-2">Being edited</Eyebrow>
          <ul className="space-y-2">
            {editing?.map((script) => (
              <li key={script.id} className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 px-4 py-3 text-sm">
                <span className="text-ink">{script.title}</span>
                <Badge>In the edit</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
