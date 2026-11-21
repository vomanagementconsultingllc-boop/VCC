import { Badge, Card, CardTitle, PageHeader, buttonClass } from "@/components/ui";

const FOUND = [
  {
    handle: "@dr.maya.smiles",
    views: "1.2M",
    usual: "85K",
    times: 14,
    hook: "You are probably brushing your teeth wrong.",
    niche: "dentist",
  },
  {
    handle: "@coachdre",
    views: "640K",
    usual: "110K",
    times: 5.8,
    hook: "Your squat is stuck because of your ankles, not your legs.",
    niche: "personal trainer",
  },
  {
    handle: "@glowbyjen",
    views: "96K",
    usual: "60K",
    times: 1.6,
    hook: "I tried the viral ice facial so you do not have to.",
    niche: "skincare",
  },
];

/** Demo of the team's Research page: videos found, and the two things you do with one. */
export default function DemoTeamResearch() {
  return (
    <>
      <PageHeader
        title="Research"
        subtitle="Videos that did far better than normal for their creator: 3 times their usual views or more. Save the best openings as hooks."
        actions={<span className={buttonClass("secondary")}>Hook library</span>}
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {FOUND.map((v) => (
            <Card key={v.handle}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">
                    {v.handle} <span className="font-normal text-ink-3">· tiktok</span>
                  </p>
                  <p className="text-sm text-ink-2">
                    {v.views} views · they usually get {v.usual}
                  </p>
                </div>
                <Badge tone={v.times >= 3 ? "success" : "neutral"}>{v.times}x their usual</Badge>
              </div>
              <p className="mt-3 font-display text-lg text-ink">“{v.hook}”</p>
              <p className="mt-2 text-sm">
                <span className="font-semibold text-gold-hover underline">Watch the video</span>
                <span className="text-ink-3"> · {v.niche}</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <span className={buttonClass("primary")}>Start the video</span>
                <span className={buttonClass("secondary")}>Save hook</span>
                <span className={buttonClass("ghost")}>Hide</span>
              </div>
            </Card>
          ))}
        </div>
        <aside>
          <Card>
            <CardTitle>Find new videos</CardTitle>
            <p className="mb-3 text-sm text-ink-2">
              Searches one niche for videos that did unusually well. This also runs by itself every week.
            </p>
            <span className={buttonClass("secondary")}>Search now</span>
          </Card>
        </aside>
      </div>
    </>
  );
}
