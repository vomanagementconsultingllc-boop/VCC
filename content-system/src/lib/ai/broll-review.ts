import "server-only";
import { z } from "zod";
import { askStructured, type AiImage } from "./client";

const reviewSchema = z.object({
  usable: z.boolean().describe("True if an editor could use this clip for the request as it is."),
  problems: z
    .array(z.string())
    .describe("Short labels for what is wrong, e.g. 'too dark', 'wrong subject'. Empty when usable."),
  advice: z
    .string()
    .describe("Two to four plain sentences to the person who filmed it: what to change and how. Empty when usable."),
});

export type BrollReview = z.infer<typeof reviewSchema>;

const SYSTEM = `You review b-roll that small business owners film on their phones for short social videos. An editor will cut these clips into a video.

You are shown still frames taken at even intervals through one clip, in order, plus what the clip was supposed to show.

Decide whether an editor could use the clip. Judge only what the frames show:
- Subject: does it show what was asked for?
- Light: can you clearly see the subject, or is it too dark, blown out, or badly backlit?
- Focus and stability: are the frames sharp? Heavy blur across most frames usually means a shaky or out-of-focus clip.
- Framing: is the subject in frame and unobstructed (no finger over the lens, nothing cut off that matters)?
- Anything that makes it unusable: a dirty lens, a screen recording, text overlays or watermarks from another app.

Be practical. This is phone footage and it does not need to be cinematic. Pass a clip that is good enough to use. Fail a clip only for a problem an editor could not work around.

You cannot hear sound or see motion between frames, so do not comment on audio or camera movement.

When a clip is not usable, write the advice directly to the person who filmed it, in plain everyday words, kind and specific: name the one or two things to change and exactly how (where to stand, where the light should be, how to hold the phone). No jargon, no lists, no praise sandwich.`;

/** Ask whether a b-roll clip is good enough, from still frames. Sends only the request text and the frames. */
export async function reviewBroll(input: {
  clientId: string;
  userId: string | null;
  request: { title: string; instructions: string; orientation: "portrait" | "landscape" };
  frames: AiImage[];
}): Promise<BrollReview> {
  const prompt = [
    `What to shoot: ${input.request.title}`,
    input.request.instructions ? `How to shoot it: ${input.request.instructions}` : "",
    `Phone orientation asked for: ${input.request.orientation === "portrait" ? "upright (portrait)" : "sideways (landscape)"}`,
    `The ${input.frames.length} images above are frames from the clip, in order.`,
  ]
    .filter(Boolean)
    .join("\n");
  return askStructured({
    purpose: "broll_review",
    clientId: input.clientId,
    userId: input.userId,
    system: SYSTEM,
    prompt,
    images: input.frames,
    schema: reviewSchema,
    effort: "medium",
  });
}
