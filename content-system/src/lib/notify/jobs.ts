import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { runBrollReview } from "@/lib/broll/run-review";
import { runFootageCheck } from "@/lib/footage/run-check";
import { wantsEmail } from "@/lib/notification-prefs";
import { pullTikTokOutliers } from "@/lib/research/apify";
import { sendEmail } from "./email";

/**
 * Background work with no signed-in user, run on a schedule. Everything here
 * uses the service role, so each function only ever touches the rows its
 * own query selected.
 */

// Which notification kinds a client can switch off, and the preference that controls each.
const CLIENT_PREF: Record<string, string> = {
  script_ready: "script_ready",
  footage_reminder: "footage_reminder",
  delivered: "delivered",
};

/** Email everything in the outbox, respecting each client's email preferences. */
export async function sendQueuedNotifications(limit = 50): Promise<{ sent: number; skipped: number; failed: number }> {
  const admin = createAdminClient();
  const tally = { sent: 0, skipped: 0, failed: 0 };
  const { data: queue } = await admin
    .from("notifications")
    .select("id, kind, subject, body, link, recipient:profiles!notifications_recipient_id_fkey(email, role, notification_prefs)")
    .eq("email_status", "queued")
    .order("created_at")
    .limit(limit);
  for (const item of queue ?? []) {
    const recipient = Array.isArray(item.recipient) ? item.recipient[0] : item.recipient;
    let status: "sent" | "skipped" | "failed" = "skipped";
    const pref = CLIENT_PREF[item.kind];
    const optedOut = recipient?.role === "client" && pref != null && !wantsEmail(recipient.notification_prefs, pref);
    if (recipient?.email && !optedOut) {
      status = await sendEmail({ to: recipient.email, subject: item.subject, body: item.body, link: item.link });
    }
    tally[status] += 1;
    await admin
      .from("notifications")
      .update({ email_status: status, sent_at: status === "sent" ? new Date().toISOString() : null })
      .eq("id", item.id);
  }
  return tally;
}

const DAY = 24 * 60 * 60 * 1000;

/** Footage reminders at 3 days and 6 days after approval, once each. */
export async function sendFootageReminders(now = new Date()): Promise<number> {
  const admin = createAdminClient();
  const { data: scripts } = await admin
    .from("scripts")
    .select("id, client_id, title, footage_requested_at")
    .eq("stage", "awaiting_footage")
    .lte("footage_requested_at", new Date(now.getTime() - 3 * DAY).toISOString());
  let queued = 0;
  for (const script of scripts ?? []) {
    const { data: internal } = await admin
      .from("script_internal")
      .select("footage_reminders_sent")
      .eq("script_id", script.id)
      .maybeSingle();
    const sent = internal?.footage_reminders_sent ?? 0;
    const days = script.footage_requested_at ? (now.getTime() - new Date(script.footage_requested_at).getTime()) / DAY : 0;
    const due = sent === 0 ? days >= 3 : sent === 1 ? days >= 6 : false;
    if (!due) continue;
    const { data: people } = await admin.from("profiles").select("id").eq("client_id", script.client_id).eq("role", "client");
    if (people?.length) {
      await admin.from("notifications").insert(
        people.map((p) => ({
          recipient_id: p.id,
          client_id: script.client_id,
          kind: "footage_reminder",
          subject: sent === 0 ? "A reminder to film your video" : "Your footage is still to come",
          body: `Your upload slots for "${script.title}" are open. It takes about ten minutes: read from the teleprompter and upload one clip per shot.`,
          link: `/portal/scripts/${script.id}`,
        })),
      );
      queued += people.length;
    }
    await admin
      .from("script_internal")
      .update({ footage_reminders_sent: sent + 1, last_reminder_at: now.toISOString() })
      .eq("script_id", script.id);
  }
  return queued;
}

/** Tell the team about edit jobs past their due date, once per job. */
export async function flagOverdueJobs(now = new Date()): Promise<number> {
  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("edit_jobs")
    .select("id, client_id, client_label, due_date")
    .in("status", ["queued", "in_progress", "revision"])
    .lt("due_date", now.toISOString().slice(0, 10));
  let queued = 0;
  for (const job of jobs ?? []) {
    const link = `/team/jobs/${job.id}`;
    const { data: already } = await admin.from("notifications").select("id").eq("kind", "job_overdue").eq("link", link).limit(1);
    if (already?.length) continue;
    const { data: client } = await admin.from("clients").select("assigned_team_member").eq("id", job.client_id).maybeSingle();
    const { data: people } = client?.assigned_team_member
      ? { data: [{ id: client.assigned_team_member }] }
      : await admin.from("profiles").select("id").eq("role", "admin");
    if (!people?.length) continue;
    await admin.from("notifications").insert(
      people.map((p) => ({
        recipient_id: p.id,
        client_id: job.client_id,
        kind: "job_overdue",
        subject: `Edit job overdue: ${job.client_label}`,
        body: `This job was due ${job.due_date} and has not been submitted.`,
        link,
      })),
    );
    queued += people.length;
  }
  return queued;
}

/** Re-run checks that never finished (the uploader closed the page, a check timed out). */
export async function sweepPendingReviews(now = new Date()): Promise<number> {
  const admin = createAdminClient();
  const olderThan = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const [{ data: footage }, { data: broll }] = await Promise.all([
    admin.from("footage_uploads").select("id").eq("check_status", "pending").eq("superseded", false).lt("uploaded_at", olderThan).limit(20),
    // Only b-roll the technical check has not measured yet; measured clips are waiting on a person.
    admin
      .from("broll_submissions")
      .select("id")
      .eq("check_status", "pending")
      .eq("superseded", false)
      .is("duration_seconds", null)
      .lt("uploaded_at", olderThan)
      .limit(20),
  ]);
  for (const row of footage ?? []) await runFootageCheck(row.id);
  for (const row of broll ?? []) await runBrollReview(row.id, null);
  return (footage?.length ?? 0) + (broll?.length ?? 0);
}

/** Weekly: pull outliers for every niche that has an active client. Niche keywords only. */
export async function pullWeeklyResearch(): Promise<number> {
  if (!process.env.APIFY_TOKEN) return 0;
  const admin = createAdminClient();
  const { data: clients } = await admin.from("clients").select("niche_tags").in("status", ["onboarding", "active"]);
  const niches = [...new Set((clients ?? []).flatMap((c) => c.niche_tags))];
  let added = 0;
  for (const niche of niches) {
    const outliers = await pullTikTokOutliers([niche]).catch(() => []);
    if (!outliers.length) continue;
    const { data } = await admin
      .from("research_items")
      .upsert(
        outliers.map((o) => ({
          source_url: o.sourceUrl,
          platform: o.platform,
          creator_handle: o.creatorHandle,
          follower_count: o.followerCount,
          view_count: o.viewCount,
          likes: o.likes,
          comments: o.comments,
          posted_at: o.postedAt,
          creator_median_views: o.creatorMedianViews,
          transcript: o.caption,
          niche_tags: [niche],
          source: "apify",
          added_by: null,
        })),
        { onConflict: "source_url", ignoreDuplicates: true },
      )
      .select("id");
    added += data?.length ?? 0;
  }
  return added;
}
