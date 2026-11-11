/**
 * Auto-checks for uploaded footage. Pure functions: given what the file is
 * (from the server-side probe) and what the shot asked for, decide which
 * problems to flag. Problems are flagged before an editor ever sees the clip.
 */
export type Probe = {
  hasVideo: boolean;
  hasAudio: boolean;
  durationSeconds: number | null;
  /** Dimensions as displayed, after applying any rotation the phone recorded. */
  width: number | null;
  height: number | null;
};

export type ShotRequirement = {
  orientation: "portrait" | "landscape";
  minDurationSeconds: number;
};

export type FootageFlag = "unreadable" | "too_short" | "wrong_orientation" | "silent" | "reshoot_requested";

export function evaluateFootage(probe: Probe, shot: ShotRequirement): FootageFlag[] {
  if (!probe.hasVideo || probe.width == null || probe.height == null) {
    return ["unreadable"];
  }
  const flags: FootageFlag[] = [];
  // A small tolerance, so a 4.97s clip for a 5s shot is not bounced.
  if (probe.durationSeconds == null || probe.durationSeconds + 0.25 < shot.minDurationSeconds) {
    flags.push("too_short");
  }
  if (probe.width !== probe.height) {
    const actual = probe.height > probe.width ? "portrait" : "landscape";
    if (actual !== shot.orientation) flags.push("wrong_orientation");
  }
  if (!probe.hasAudio) flags.push("silent");
  return flags;
}

/** What to tell the client, in plain words, so they know exactly what to redo. */
export function describeFlag(
  flag: string,
  shot: ShotRequirement,
  probe?: { durationSeconds: number | null },
): string {
  switch (flag) {
    case "too_short": {
      const got = probe?.durationSeconds != null ? `${Math.round(probe.durationSeconds)} seconds` : "too short";
      return `This clip is ${got}. This shot needs at least ${shot.minDurationSeconds} seconds.`;
    }
    case "wrong_orientation":
      return shot.orientation === "portrait"
        ? "This was filmed sideways. Hold your phone upright and record it again."
        : "This was filmed upright. Turn your phone sideways and record it again.";
    case "silent":
      return "We could not find any sound in this clip. Check your microphone is not muted and record it again.";
    case "unreadable":
      return "We could not read this file as a video. Try recording it again with your phone camera.";
    case "reshoot_requested":
      return "The team asked for this shot to be recorded again.";
    default:
      return "There is a problem with this clip. Please record it again.";
  }
}

export const FLAG_LABEL: Record<string, string> = {
  too_short: "Too short",
  wrong_orientation: "Wrong orientation",
  silent: "No audio",
  unreadable: "Unreadable",
  reshoot_requested: "Reshoot requested",
};
