import { CLIENT_STEPS, stageIndex, type Stage } from "@/lib/labels";

/** The simple "where is my video" checklist a client sees. */
export function StageChecklist({ stage }: { stage: Stage }) {
  const current = stageIndex(stage);
  return (
    <ol className="space-y-2">
      {CLIENT_STEPS.map((step) => {
        const done = current >= stageIndex(step.doneFrom);
        return (
          <li key={step.label} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className={
                done
                  ? "flex size-6 items-center justify-center rounded-full bg-success text-xs font-bold text-white"
                  : "size-6 rounded-full border-2 border-line-strong"
              }
            >
              {done ? "✓" : ""}
            </span>
            <span className={done ? "text-ink" : "text-ink-3"}>
              {step.label}
              <span className="sr-only">{done ? " (done)" : " (not yet)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
