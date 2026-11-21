import Link from "next/link";
import { Badge } from "@/components/ui";
import { STAGES, STAGE_NOW, STAGE_STEP, STEPS, formatDate, type Stage } from "@/lib/labels";

export type BoardVideo = {
  id: string;
  title: string;
  stage: Stage;
  client: string;
  /** Where the next thing for this video gets done. */
  href: string;
  /** The client is past their date to film. */
  late: boolean;
  dueDate: string | null;
};

const WAITING_ON = { team: "You", client: "Client", editor: "Editor", nobody: "" } as const;

/**
 * Every video in progress, in the same three steps the client sees. Within a
 * step, the ones waiting on the team come first and carry a "You" tag.
 */
export function VideoBoard({ videos }: { videos: BoardVideo[] }) {
  const mine = (v: BoardVideo) => (STAGES[v.stage].waitingOn === "team" || v.late ? 0 : 1);
  const active = videos.filter((v) => v.stage !== "posted");
  const posted = videos.filter((v) => v.stage === "posted");

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {STEPS.map((step) => {
          const inStep = active.filter((v) => STAGE_STEP[v.stage] === step.key).sort((a, b) => mine(a) - mine(b));
          return (
            <section key={step.key} className="rounded-[24px] bg-ink/[0.04] p-3" aria-labelledby={`step-${step.key}`}>
              <h2 id={`step-${step.key}`} className="flex items-center gap-2 px-2 pt-1 font-display text-2xl text-ink">
                <span className="flex size-7 items-center justify-center rounded-full border border-current font-mono text-xs">
                  {step.number}
                </span>
                {step.label}
                <span className="ml-auto font-sans text-sm text-ink-3">{inStep.length}</span>
              </h2>
              <p className="px-2 pb-3 pt-1 text-sm text-ink-2">{step.about}</p>
              {!inStep.length ? (
                <p className="px-2 pb-2 text-sm text-ink-3">Nothing here right now.</p>
              ) : (
                <ul className="space-y-2">
                  {inStep.map((v) => {
                    const who = v.late ? "You" : WAITING_ON[STAGES[v.stage].waitingOn];
                    return (
                      <li key={v.id}>
                        <Link
                          href={v.href}
                          className="block rounded-2xl border border-ink/[0.06] bg-surface p-3 text-sm shadow-soft hover:border-gold"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0 font-semibold text-ink">{v.title}</span>
                            {who === "You" ? (
                              <span className="inline-flex shrink-0 items-center rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-on-gold">
                                You
                              </span>
                            ) : (
                              who && <Badge>{who}</Badge>
                            )}
                          </span>
                          <span className="block text-ink-2">{v.client}</span>
                          <span className={v.late ? "mt-1 block font-semibold text-danger" : "mt-1 block text-ink"}>
                            {v.late
                              ? `Footage is late${v.dueDate ? ` (due ${formatDate(v.dueDate)})` : ""}. Give them a nudge`
                              : STAGE_NOW[v.stage]}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {posted.length > 0 && (
        <details className="mt-6 panel border border-ink/[0.06] px-5 py-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink">Posted ({posted.length})</summary>
          <ul className="divide-y divide-line pb-2">
            {posted.map((v) => (
              <li key={v.id}>
                <Link href={v.href} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-gold">
                  <span className="min-w-0 truncate font-semibold text-ink">{v.title}</span>
                  <span className="shrink-0 text-ink-2">{v.client}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
