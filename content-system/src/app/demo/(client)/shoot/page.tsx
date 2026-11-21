import { Guide } from "@/components/guide";
import { Teleprompter } from "@/components/teleprompter";
import { Badge, Card, CardTitle, Eyebrow, buttonClass } from "@/components/ui";

const SCRIPT = `You are probably brushing your teeth wrong.
Most people scrub. Hard. Like they are cleaning a pan.
That wears the enamel away, and it does not grow back.
Hold the brush like a pen. Small circles. Two minutes.
If your bristles splay out after a month, you are pressing too hard.
Be kind to your teeth. They are the only set you get.`;

const SHOTS = [
  { n: 1, what: "Talk to the camera at the front desk", how: "Phone upright at eye level, logo behind you. Face the window.", state: "ok" },
  { n: 2, what: "Show the brushing motion on the model teeth", how: "Treatment room 2, close up on your hands. Hold still for 8 seconds.", state: "redo" },
  { n: 3, what: "Closing line, walking to the door", how: "Someone holds the phone and walks backwards in front of you.", state: "todo" },
];

/** Demo of step 2: one video's directions, teleprompter and clip boxes. */
export default function DemoShoot() {
  return (
    <>
      <header>
        <Eyebrow>Step 2 of 3</Eyebrow>
        <h1 className="mt-1 font-display text-4xl text-ink">Shoot</h1>
      </header>
      <Guide mood="oops">
        One clip needs another go. I have said exactly what to change on it. It will only take a minute.
      </Guide>
      <Card flush>
        <div className="px-5 pt-5">
          <CardTitle>Brushing too hard</CardTitle>
          <p className="-mt-2 mb-3 text-sm text-ink-2">Tap the text to start and pause. Use full screen while you record.</p>
        </div>
        <Teleprompter text={SCRIPT} className="rounded-t-none" />
      </Card>
      <ol className="space-y-4">
        {SHOTS.map((shot) => (
          <li key={shot.n} className="panel border border-ink/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 flex-1 font-semibold text-ink">
                Shot {shot.n}: {shot.what}
              </p>
              {shot.state === "ok" && <Badge>Looks good</Badge>}
              {shot.state === "redo" && <Badge tone="danger">Needs a reshoot</Badge>}
              {shot.state === "todo" && <Badge>Not uploaded yet</Badge>}
            </div>
            <p className="mt-2 text-sm text-ink-2">{shot.how}</p>
            {shot.state === "redo" && (
              <p className="mt-3 rounded-2xl bg-warning-soft px-3 py-2 text-sm text-ink">
                It is too dark to see your hands. Stand so the window is in front of you, not behind you, and film it
                again.
              </p>
            )}
            {shot.state !== "ok" && (
              <span className={buttonClass("primary", "mt-4 w-full")}>
                {shot.state === "redo" ? "Record this shot again" : "Record or choose video"}
              </span>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
