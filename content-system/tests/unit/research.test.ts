import { describe, expect, it, vi } from "vitest";
import { creatorMedian, isOutlier, median, performanceRatio } from "@/lib/research/metrics";
import { normalizeTikTokItem, pullTikTokOutliers } from "@/lib/research/apify";

describe("outlier maths", () => {
  it("takes the median, not the average, so one viral post does not move the baseline", () => {
    expect(median([10, 20, 30])).toBe(20);
    expect(median([10, 20, 30, 1_000_000])).toBe(25);
    expect(median([])).toBeNull();
  });

  it("uses only the creator's last 20 posts", () => {
    const recent = [...Array(20).fill(100), ...Array(30).fill(1_000_000)];
    expect(creatorMedian(recent)).toBe(100);
  });

  it("calls a video an outlier at 3x the creator's own median", () => {
    expect(performanceRatio(300_000, 100_000)).toBe(3);
    expect(isOutlier(performanceRatio(300_000, 100_000))).toBe(true);
    expect(isOutlier(performanceRatio(299_000, 100_000))).toBe(false);
    // Raw views alone are not a signal: 2M views on a 1.5M median is ordinary.
    expect(isOutlier(performanceRatio(2_000_000, 1_500_000))).toBe(false);
    expect(performanceRatio(500, null)).toBeNull();
    expect(performanceRatio(500, 0)).toBeNull();
  });
});

describe("Apify pull", () => {
  const item = (handle: string, views: number, n: number) => ({
    webVideoUrl: `https://www.tiktok.com/@${handle}/video/${n}`,
    playCount: views,
    diggCount: 10,
    commentCount: 2,
    createTimeISO: `2027-01-${String((n % 27) + 1).padStart(2, "0")}T00:00:00.000Z`,
    text: `caption ${n}`,
    authorMeta: { name: handle, fans: 5000 },
  });

  it("normalises a scraper row and skips rows that are not videos", () => {
    expect(normalizeTikTokItem(item("bakerjoe", 1234, 1))).toMatchObject({
      sourceUrl: "https://www.tiktok.com/@bakerjoe/video/1",
      creatorHandle: "bakerjoe",
      viewCount: 1234,
      followerCount: 5000,
      caption: "caption 1",
    });
    expect(normalizeTikTokItem({ note: "no video here" })).toBeNull();
  });

  it("sends the scraper niche keywords and creator handles, and nothing else", async () => {
    vi.stubEnv("APIFY_TOKEN", "test-token");
    const bodies: unknown[] = [];
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      const rows = body.searchQueries
        ? [item("bakerjoe", 90_000, 1), item("bigbakery", 400_000, 2)]
        : [
            ...Array.from({ length: 20 }, (_, i) => item("bakerjoe", 10_000, 100 + i)),
            ...Array.from({ length: 20 }, (_, i) => item("bigbakery", 350_000, 200 + i)),
          ];
      return new Response(JSON.stringify(rows), { status: 200 });
    }) as unknown as typeof fetch;

    const outliers = await pullTikTokOutliers(["sourdough bakery", " "], { fetchImpl });

    // The small account's 90k on a 10k median is the outlier; the big account's 400k on 350k is not.
    expect(outliers.map((o) => o.creatorHandle)).toEqual(["bakerjoe"]);
    expect(outliers[0].ratio).toBe(9);
    expect(outliers[0].creatorMedianViews).toBe(10_000);

    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toEqual({ searchQueries: ["sourdough bakery"], resultsPerPage: 30 });
    expect(Object.keys(bodies[1] as object).sort()).toEqual(["profiles", "resultsPerPage"]);
    vi.unstubAllEnvs();
  });
});
