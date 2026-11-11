import type { Metadata } from "next";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CopyButton } from "@/components/copy-button";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import { formatDate, one } from "@/lib/labels";

export const metadata: Metadata = { title: "Delivered" };

const POSTING_CHECKLIST = [
  "Download the video to your phone.",
  "Post it as a Reel, TikTok or Short. Do not send it through a messaging app first, it lowers the quality.",
  "Paste the caption. Change any word that does not sound like you.",
  "Post at a time your customers are on their phones.",
  "Reply to every comment in the first hour.",
];

export default async function DeliveredPage() {
  await requireClient();
  const supabase = await createClient();
  // Row level security: only this client's delivered videos exist for them.
  const { data: videos } = await supabase
    .from("deliverables")
    .select("id, caption_draft, delivered_at, client_downloaded_at, alt_file_path, script:scripts(title, stage)")
    .order("delivered_at", { ascending: false });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-ink">Delivered</h1>
      {!videos?.length ? (
        <EmptyState title="No finished videos yet">They show up here the moment they are ready.</EmptyState>
      ) : (
        videos.map((video) => {
          const script = one(video.script);
          return (
            <Card key={video.id}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl text-ink">{script?.title ?? "Your video"}</h2>
                  <p className="text-sm text-ink-2">Delivered {formatDate(video.delivered_at)}</p>
                </div>
                {script?.stage === "posted" ? (
                  <Badge tone="success">Posted</Badge>
                ) : video.client_downloaded_at ? (
                  <Badge tone="info">Downloaded</Badge>
                ) : (
                  <Badge tone="gold">New</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`/api/media/deliverable/${video.id}?download=1`} className={buttonClass("primary")}>
                  Download video
                </a>
                {video.alt_file_path && (
                  <a href={`/api/media/deliverable/${video.id}?download=1&v=alt`} className={buttonClass("secondary")}>
                    Download second version
                  </a>
                )}
              </div>
              {video.caption_draft && (
                <div className="mt-4">
                  <h3 className="mb-1 text-sm font-semibold text-ink">Caption</h3>
                  <p className="mb-3 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">
                    {video.caption_draft}
                  </p>
                  <CopyButton text={video.caption_draft} />
                </div>
              )}
              <details className="mt-4">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink">
                  Posting checklist
                </summary>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-ink-2">
                  {POSTING_CHECKLIST.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </details>
            </Card>
          );
        })
      )}
    </div>
  );
}
