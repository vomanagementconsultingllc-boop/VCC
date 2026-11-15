import { Guide } from "@/components/guide";
import { Badge, Eyebrow, Field, Textarea, buttonClass } from "@/components/ui";

/** Demo of step 3: an edit to review, and approved videos to download. */
export default function DemoFinish() {
  return (
    <>
      <header>
        <Eyebrow>Step 3 of 3</Eyebrow>
        <h1 className="mt-1 font-display text-4xl text-ink">Finish</h1>
      </header>
      <Guide mood="cheer">
        Your edit is back. Watch it through. If something is off, tell me what and we will fix it. If it is right,
        approve it and it is yours to download.
      </Guide>

      <section className="panel border border-ink/15 p-5">
        <Eyebrow className="text-ink-2">Ready for you to watch</Eyebrow>
        <h2 className="mt-1 font-display text-2xl text-ink">Nobody tells you this about whitening</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={buttonClass("secondary")}>Watch the edit</span>
          <span className={buttonClass("ghost")}>Compare with the inspiration ↗</span>
        </div>
        <span className={buttonClass("primary", "mt-4 w-full")}>Approve it</span>
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-2">Something to fix?</summary>
          <Field label="What should change?" hint="Be as specific as you can: where in the video, and what you want instead.">
            <Textarea placeholder="At the start the caption covers my face. And cut the bit where I cough." />
          </Field>
          <span className={buttonClass("secondary", "mt-3")}>Send it back for a fix</span>
        </details>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow className="text-ink-2">Approved</Eyebrow>
          <span className={buttonClass("primary")}>Download all (2)</span>
        </div>
        {["Brushing too hard", "Three things I would never do as a dentist"].map((title, i) => (
          <div key={title} className="panel border border-ink/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="min-w-0 flex-1 font-display text-xl text-ink">{title}</h2>
              <Badge>{i === 0 ? "Posted" : "Ready to post"}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={buttonClass("primary")}>Download</span>
              <span className={buttonClass("secondary")}>Copy caption</span>
            </div>
          </div>
        ))}
      </section>

      <section>
        <Eyebrow className="mb-2 text-ink-2">Being edited</Eyebrow>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 px-4 py-3 text-sm">
          <span className="text-ink">Stop doing this before your check-up</span>
          <Badge>In the edit</Badge>
        </div>
      </section>
    </>
  );
}
