import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfigured, AiUnavailableError, type AiImage } from "@/lib/ai/client";
import { reviewBroll } from "@/lib/ai/broll-review";
import { describeFlag, evaluateFootage } from "@/lib/footage/checks";
import { probeUrl } from "@/lib/footage/probe";
import { BUCKETS } from "@/lib/storage";

export type BrollOutcome = { status: "passed" | "failed" | "pending"; advice: string };

/**
 * Review one b-roll submission and store the verdict.
 *
 *   1. Technical check from the file itself: readable, long enough, held the
 *      right way. (B-roll does not need sound.)
 *   2. If that passes and AI is set up, a visual review of the still frames:
 *      right subject, enough light, in focus, usable.
 *
 * A failed review writes advice the client sees on their submission box.
 * With no AI key, or if the AI call fails, the clip waits for the team.
 *
 * Uses the service role: callers must have established that the current user
 * may act on this submission (they just inserted it, or they are staff).
 */
export async function runBrollReview(submissionId: string, userId: string | null): Promise<BrollOutcome> {
  const admin = createAdminClient();
  const waiting: BrollOutcome = { status: "pending", advice: "" };

  const { data: sub } = await admin
    .from("broll_submissions")
    .select("id, request_id, client_id, storage_path, frame_paths")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return waiting;
  const { data: request } = await admin
    .from("broll_requests")
    .select("title, instructions, orientation, min_duration_seconds")
    .eq("id", sub.request_id)
    .maybeSingle();
  if (!request) return waiting;

  const save = async (fields: {
    check_status: "passed" | "failed";
    flags: string[];
    feedback: string;
    reviewed_by: "auto" | "ai";
    duration_seconds?: number | null;
    width?: number | null;
    height?: number | null;
  }): Promise<BrollOutcome> => {
    const { error } = await admin
      .from("broll_submissions")
      .update({ ...fields, checked_at: new Date().toISOString() })
      .eq("id", submissionId);
    return error ? waiting : { status: fields.check_status, advice: fields.feedback };
  };

  // 1. Technical check.
  const { data: signed } = await admin.storage.from(BUCKETS.broll).createSignedUrl(sub.storage_path, 120);
  if (!signed?.signedUrl) return waiting;
  let probe;
  try {
    probe = await probeUrl(signed.signedUrl);
  } catch {
    return waiting;
  }
  const requirement = { orientation: request.orientation, minDurationSeconds: request.min_duration_seconds };
  const flags = evaluateFootage(probe, requirement).filter((flag) => flag !== "silent");
  const measured = { duration_seconds: probe.durationSeconds, width: probe.width, height: probe.height };
  if (flags.length) {
    return save({
      check_status: "failed",
      flags,
      feedback: flags.map((f) => describeFlag(f, requirement, { durationSeconds: probe.durationSeconds })).join(" "),
      reviewed_by: "auto",
      ...measured,
    });
  }
  await admin.from("broll_submissions").update(measured).eq("id", submissionId);

  // 2. Visual review.
  if (!aiConfigured() || sub.frame_paths.length === 0) return waiting;
  const frames: AiImage[] = [];
  for (const path of sub.frame_paths) {
    const { data: blob } = await admin.storage.from(BUCKETS.broll).download(path);
    if (blob) frames.push({ mediaType: "image/jpeg", base64: Buffer.from(await blob.arrayBuffer()).toString("base64") });
  }
  if (frames.length === 0) return waiting;

  try {
    const review = await reviewBroll({
      clientId: sub.client_id,
      userId,
      request: { title: request.title, instructions: request.instructions, orientation: request.orientation },
      frames,
    });
    return save({
      check_status: review.usable ? "passed" : "failed",
      flags: review.usable ? [] : review.problems.slice(0, 6),
      feedback: review.usable ? "" : review.advice,
      reviewed_by: "ai",
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) return waiting;
    throw error;
  }
}
