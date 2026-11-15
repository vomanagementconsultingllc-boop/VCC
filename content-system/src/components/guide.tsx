import type { ReactNode } from "react";
import { cn } from "@/components/ui";

/**
 * Reel, the guide. One character, drawn once here and used everywhere, so
 * clients always meet the same face. Reel is a little film-clapper person:
 * a striped clapper for a hat, round head, two dots for eyes. Monochrome,
 * thick outline.
 *
 * The only thing that changes is the mood: the mouth, the eyebrows and the
 * arms. The head, hat, eyes and body are identical in every pose.
 */
export type Mood = "happy" | "cheer" | "think" | "oops";

const INK = "#120e0b";
const PAPER = "#f4f1ea";

const MOUTH: Record<Mood, ReactNode> = {
  happy: <path d="M50 70 Q60 80 70 70" fill="none" />,
  cheer: <path d="M48 68 Q60 86 72 68 Z" fill={INK} />,
  think: <path d="M52 73 H68" fill="none" />,
  oops: <path d="M51 76 Q60 68 69 76" fill="none" />,
};

const ARMS: Record<Mood, ReactNode> = {
  happy: (
    <>
      <path d="M38 104 Q26 110 24 122" fill="none" />
      <path d="M82 104 Q96 100 100 88" fill="none" />
    </>
  ),
  cheer: (
    <>
      <path d="M38 102 Q24 94 20 80" fill="none" />
      <path d="M82 102 Q96 94 100 80" fill="none" />
    </>
  ),
  think: (
    <>
      <path d="M38 104 Q26 110 24 122" fill="none" />
      <path d="M82 104 Q94 100 76 84" fill="none" />
    </>
  ),
  oops: (
    <>
      <path d="M38 104 Q24 104 18 96" fill="none" />
      <path d="M82 104 Q96 104 102 96" fill="none" />
    </>
  ),
};

export function Reel({ mood = "happy", size = 88, className }: { mood?: Mood; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      role="img"
      aria-label="Reel, your guide"
      className={cn("shrink-0", className)}
      stroke={INK}
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* arms: drawn in paper, so they show on the dark background */}
      <g stroke={PAPER} strokeWidth={8}>
        {ARMS[mood]}
      </g>
      {/* body, tucked under the head */}
      <path d="M38 88 Q38 132 60 132 Q82 132 82 88 Z" fill={PAPER} />
      {/* head */}
      <rect x="22" y="34" width="76" height="62" rx="28" fill={PAPER} />
      {/* clapper hat: a slanted striped bar */}
      <g transform="rotate(-10 60 30)">
        <rect x="26" y="20" width="68" height="16" rx="5" fill={PAPER} />
        <path d="M40 20 L34 36 M56 20 L50 36 M72 20 L66 36 M88 20 L82 36" strokeWidth={6} />
      </g>
      {/* eyes */}
      <circle cx="46" cy="60" r="5.5" fill={INK} stroke="none" />
      <circle cx="74" cy="60" r="5.5" fill={INK} stroke="none" />
      <circle cx="47.8" cy="58.2" r="1.7" fill={PAPER} stroke="none" />
      <circle cx="75.8" cy="58.2" r="1.7" fill={PAPER} stroke="none" />
      {mood === "think" && <path d="M68 49 L80 46" fill="none" strokeWidth={4} />}
      {/* worried brows: inner ends up, so it reads as "oops", not cross */}
      {mood === "oops" && <path d="M40 52 L52 47 M68 47 L80 52" fill="none" strokeWidth={4} />}
      {/* mouth */}
      <g strokeWidth={4}>{MOUTH[mood]}</g>
    </svg>
  );
}

/**
 * Reel saying something, in a speech bubble. This is how the app talks to
 * clients: one short message at a time, from the same character.
 */
export function Guide({
  mood = "happy",
  children,
  className,
  size = 80,
}: {
  mood?: Mood;
  children: ReactNode;
  className?: string;
  size?: number;
}) {
  return (
    <div className={cn("flex items-end gap-2", className)} data-testid="guide">
      <Reel mood={mood} size={size} />
      <div className="relative mb-4 min-w-0 flex-1">
        {/* the bubble's tail, pointing at Reel */}
        <span
          aria-hidden
          className="absolute -left-1.5 bottom-5 size-4 rotate-45 rounded-[4px] border-b border-l border-ink/15 bg-[#221c17]"
        />
        <div className="relative rounded-[22px] rounded-bl-md border border-ink/15 bg-[#221c17] px-4 py-3 text-[15px] leading-snug text-ink shadow-soft">
          {children}
        </div>
      </div>
    </div>
  );
}
