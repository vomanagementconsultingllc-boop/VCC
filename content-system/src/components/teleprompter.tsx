"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/components/ui";

/**
 * Teleprompter: scrolls the script at a steady pace so it can be read aloud
 * while recording. Speed and text size are adjustable and remembered on the
 * device. Tap the text to start or pause.
 */

// Small localStorage-backed number, so a client's preferred speed and size
// survive between visits without a server round trip.
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function useStoredNumber(key: string, fallback: number): [number, (value: number) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        const raw = window.localStorage.getItem(key);
        const n = raw == null ? NaN : Number(raw);
        return Number.isFinite(n) ? n : fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
  const set = useCallback(
    (next: number) => {
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // Private browsing: the setting just will not persist.
      }
      for (const l of listeners) l();
    },
    [key],
  );
  return [value, set];
}

const SPEED = { min: 10, max: 160, step: 5, fallback: 45 }; // pixels per second
const SIZE = { min: 20, max: 72, step: 2, fallback: 34 }; // font size in px

type WakeLockSentinelLike = { release: () => Promise<void> };

export function Teleprompter({ text, className }: { text: string; className?: string }) {
  const [playing, setPlaying] = useState(false);
  const [full, setFull] = useState(false);
  const [speed, setSpeed] = useStoredNumber("teleprompter.speed", SPEED.fallback);
  const [size, setSize] = useStoredNumber("teleprompter.size", SIZE.fallback);
  const boxRef = useRef<HTMLDivElement>(null);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);

  // Scroll loop. Position is tracked as a float because scrollTop rounds.
  useEffect(() => {
    if (!playing) return;
    const box = boxRef.current;
    if (!box) return;
    let frame = 0;
    let last = performance.now();
    let position = box.scrollTop;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      position += speed * dt;
      box.scrollTop = position;
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 1) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  // Keep the phone screen awake while reading.
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    nav.wakeLock
      ?.request("screen")
      .then((lock) => {
        if (cancelled) void lock.release();
        else wakeLock.current = lock;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [playing]);

  // Full screen: lock page scroll behind it, Escape to leave.
  useEffect(() => {
    if (!full) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [full]);

  const restart = () => {
    if (boxRef.current) boxRef.current.scrollTop = 0;
    setPlaying(false);
  };

  const clamp = (value: number, range: { min: number; max: number }) =>
    Math.min(range.max, Math.max(range.min, value));

  const paragraphs = text.split(/\n+/).filter((p) => p.trim());
  const controlButton =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/25 px-3 text-sm font-semibold text-white hover:bg-white/10";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-ink text-white",
        // m-0! so a parent's spacing utility cannot shrink the full-screen layer.
        full ? "fixed inset-0 z-50 m-0!" : "rounded-xl",
        className,
      )}
      data-testid="teleprompter"
    >
      <div
        ref={boxRef}
        role="button"
        tabIndex={0}
        aria-label={playing ? "Pause teleprompter" : "Start teleprompter"}
        onClick={() => setPlaying((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setPlaying((p) => !p);
          }
        }}
        className={cn("cursor-pointer overflow-y-auto px-5", full ? "flex-1" : "h-72")}
        style={{ fontSize: size, lineHeight: 1.35 }}
        data-testid="teleprompter-text"
      >
        {/* Padding so the first and last lines can reach the reading line. */}
        <div className={full ? "h-[35vh]" : "h-24"} />
        {paragraphs.length ? (
          paragraphs.map((p, i) => (
            <p key={i} className="mb-[0.8em] font-semibold">
              {p}
            </p>
          ))
        ) : (
          <p className="text-white/60">The script is empty.</p>
        )}
        <div className={full ? "h-[60vh]" : "h-48"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/15 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className={cn(controlButton, "bg-gold border-gold")}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? "Pause" : "Start"}
        </button>
        <button type="button" className={controlButton} onClick={restart}>
          Restart
        </button>
        <span className="ml-auto flex items-center gap-1" role="group" aria-label="Scroll speed">
          <span className="mr-1 text-xs text-white/70">Speed</span>
          <button
            type="button"
            className={controlButton}
            aria-label="Slower"
            onClick={() => setSpeed(clamp(speed - SPEED.step, SPEED))}
          >
            −
          </button>
          <button
            type="button"
            className={controlButton}
            aria-label="Faster"
            onClick={() => setSpeed(clamp(speed + SPEED.step, SPEED))}
          >
            +
          </button>
        </span>
        <span className="flex items-center gap-1" role="group" aria-label="Text size">
          <span className="mr-1 text-xs text-white/70">Size</span>
          <button
            type="button"
            className={controlButton}
            aria-label="Smaller text"
            onClick={() => setSize(clamp(size - SIZE.step, SIZE))}
          >
            A−
          </button>
          <button
            type="button"
            className={controlButton}
            aria-label="Larger text"
            onClick={() => setSize(clamp(size + SIZE.step, SIZE))}
          >
            A+
          </button>
        </span>
        <button type="button" className={controlButton} onClick={() => setFull((f) => !f)}>
          {full ? "Close" : "Full screen"}
        </button>
      </div>
    </div>
  );
}
