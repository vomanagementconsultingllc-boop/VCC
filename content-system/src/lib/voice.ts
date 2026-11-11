/**
 * Voice checks that do not need AI: does this text use a word the client
 * said they never use?
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Phrases from the never-say list that appear in the text, as whole words. */
export function findNeverSay(text: string, neverSay: string[]): string[] {
  const hits: string[] = [];
  for (const phrase of neverSay) {
    const cleaned = phrase.trim();
    if (!cleaned) continue;
    // Whole-word match, tolerant of extra whitespace inside multi-word phrases.
    const pattern = cleaned.split(/\s+/).map(escapeRegExp).join("\\s+");
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "iu");
    if (re.test(text)) hits.push(cleaned);
  }
  return hits;
}

/** Rough speaking time. People read scripts aloud at about 150 words a minute. */
export function speakingSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 150) * 60);
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}
