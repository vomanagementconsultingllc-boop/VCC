import "server-only";
import { requireEnv } from "@/lib/env";
import { creatorMedian, isOutlier, performanceRatio } from "./metrics";

/**
 * Research pulls through Apify. PRIVACY: this module is only ever given
 * niche keywords. It has no access to client names, scripts or voice
 * profiles, so none of that can reach the scraper.
 *
 * NOTE: written against Apify's documented run-sync API and the public
 * TikTok scraper actor's output fields, but not yet run against a live
 * Apify account. The actor id is configurable (APIFY_TIKTOK_ACTOR) and the
 * normaliser accepts several field spellings; check one real run before
 * relying on the weekly schedule.
 */
const DEFAULT_ACTOR = "clockworks~tiktok-scraper";

export type ScrapedVideo = {
  sourceUrl: string;
  platform: "tiktok";
  creatorHandle: string;
  followerCount: number | null;
  viewCount: number;
  likes: number | null;
  comments: number | null;
  postedAt: string | null;
  caption: string;
};

export type Outlier = ScrapedVideo & { creatorMedianViews: number; ratio: number };

type Raw = Record<string, unknown>;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Map one raw actor item to our shape. Returns null if it is not a usable video row. */
export function normalizeTikTokItem(raw: Raw): ScrapedVideo | null {
  const author = (raw.authorMeta ?? raw.author ?? {}) as Raw;
  const url = str(raw.webVideoUrl) || str(raw.url) || str(raw.videoUrl);
  const views = num(raw.playCount) ?? num(raw.viewCount) ?? num(raw.views);
  const handle = str(author.name) || str(author.uniqueId) || str(raw.authorName);
  if (!url || views == null || !handle) return null;
  const created = str(raw.createTimeISO) || (num(raw.createTime) ? new Date((raw.createTime as number) * 1000).toISOString() : "");
  return {
    sourceUrl: url,
    platform: "tiktok",
    creatorHandle: handle.replace(/^@/, ""),
    followerCount: num(author.fans) ?? num(author.followers),
    viewCount: views,
    likes: num(raw.diggCount) ?? num(raw.likes),
    comments: num(raw.commentCount) ?? num(raw.comments),
    postedAt: created || null,
    caption: str(raw.text) || str(raw.desc) || str(raw.caption),
  };
}

type Fetch = typeof fetch;

async function runActor(input: Raw, fetchImpl: Fetch): Promise<Raw[]> {
  const actor = process.env.APIFY_TIKTOK_ACTOR || DEFAULT_ACTOR;
  const res = await fetchImpl(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${requireEnv("APIFY_TOKEN")}` },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Apify returned ${res.status}`);
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as Raw[]) : [];
}

/**
 * Find outliers for one niche: search videos by keyword, then pull each
 * creator's recent posts to get their own median, and keep the videos at or
 * above 3x that median.
 */
export async function pullTikTokOutliers(
  keywords: string[],
  options: { perKeyword?: number; maxCreators?: number; fetchImpl?: Fetch } = {},
): Promise<Outlier[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cleaned = keywords.map((k) => k.trim()).filter(Boolean);
  if (cleaned.length === 0) return [];

  const found = (await runActor({ searchQueries: cleaned, resultsPerPage: options.perKeyword ?? 30 }, fetchImpl))
    .map(normalizeTikTokItem)
    .filter((v): v is ScrapedVideo => v !== null);

  // Most-viewed candidates first; cap how many creator histories we pay for.
  const handles = [...new Set(found.sort((a, b) => b.viewCount - a.viewCount).map((v) => v.creatorHandle))].slice(
    0,
    options.maxCreators ?? 25,
  );
  if (handles.length === 0) return [];

  const history = (await runActor({ profiles: handles, resultsPerPage: 20 }, fetchImpl))
    .map(normalizeTikTokItem)
    .filter((v): v is ScrapedVideo => v !== null);

  const outliers: Outlier[] = [];
  for (const video of found) {
    const recent = history
      .filter((h) => h.creatorHandle === video.creatorHandle)
      .sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""))
      .map((h) => h.viewCount);
    const medianViews = creatorMedian(recent);
    const ratio = performanceRatio(video.viewCount, medianViews);
    if (medianViews && isOutlier(ratio)) outliers.push({ ...video, creatorMedianViews: medianViews, ratio: ratio! });
  }
  return outliers.sort((a, b) => b.ratio - a.ratio);
}
