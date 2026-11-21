import Link from "next/link";
import { Guide } from "@/components/guide";
import { Eyebrow, buttonClass } from "@/components/ui";

const HOOKS = [
  "You are probably brushing your teeth wrong.",
  "Nobody tells you this about whitening.",
  "Stop doing this before your check-up.",
  "The one question every nervous patient asks me.",
  "Three things I would never do as a dentist.",
  "I fixed this smile in one visit. Here is how.",
  "What your gums are trying to tell you.",
];

/** Demo of step 1 with made-up videos. */
export default function DemoPlan() {
  return (
    <>
      <header>
        <Eyebrow>Step 1 of 3</Eyebrow>
        <h1 className="mt-1 font-display text-4xl text-ink">Plan your week</h1>
      </header>
      <Guide mood="happy">
        Allison, I found 7 videos for you this week. Each one opens with a hook that is already working for someone
        like you. Watch the inspiration, read your version, and say yes to the ones you want to shoot.
      </Guide>
      <ol className="space-y-4">
        {HOOKS.map((hook, i) => (
          <li key={hook} className="panel border border-ink/10 p-5">
            <Eyebrow className="text-ink-2">
              Video {i + 1} of {HOOKS.length} · Week of Jan 4
            </Eyebrow>
            <p className="mt-2 font-display text-2xl leading-snug text-ink">“{hook}”</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/demo/shoot" className={buttonClass("primary")}>
                Read my version
              </Link>
              <span className={buttonClass("secondary")}>Watch the inspiration ↗</span>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
