import "server-only";
import { z } from "zod";
import { askStructured } from "./client";
import { FORMATS, type VideoFormat } from "@/lib/labels";

const VIDEO_FORMATS = ["talking_head", "voiceover_broll", "skit", "listicle", "reaction"] as const;
const HOOK_FORMATS = ["question", "bold_claim", "contrarian", "story_open", "number_list"] as const;

// ---------------------------------------------------------------------------
// Draft a script in the client's voice
// ---------------------------------------------------------------------------
const draftSchema = z.object({
  title: z.string().describe("Short working title for the team, not shown on screen."),
  hook: z.string().describe("The first sentence the client says, adapted to their business."),
  body: z.string().describe("The rest of the script as spoken-word prose. No stage directions, no headings."),
  shots: z
    .array(
      z.object({
        instruction: z.string().describe("One line telling the client what this shot is."),
        lines: z.string().describe("What they say in this shot. Empty for b-roll."),
        framing: z.string(),
        where_to_look: z.string(),
        orientation: z.enum(["portrait", "landscape"]),
        min_seconds: z.number().int().min(1).max(120),
      }),
    )
    .min(1)
    .max(8),
});
export type ScriptDraft = z.infer<typeof draftSchema>;

const DRAFT_SYSTEM = `You write short-form video scripts for small business owners to read on camera from a teleprompter. A human editor on our team reviews every draft before the client sees it.

You are given a hook and format that performed well for someone else, and a profile of how THIS client talks. Write a new script for this client that keeps the structural idea of the hook and format and nothing else.

Voice:
- Write the way this person talks. Use their words and phrases where they fit naturally. Their example posts show their rhythm; match it.
- Never use a word or phrase on their never-say list, and stay away from the topics they will not talk about.
- Spoken word, short sentences, one idea per sentence. It must sound right read aloud by a nervous person in one take.
- No selling language, no call to buy, no "link in bio", unless the brief asks for it.

Adaptation:
- Adapt, do not copy. Take the shape of the source (how it opens, how it builds, how it lands) and apply it to this client's own offer and customers. Do not reuse the source's sentences, examples or claims.
- Do not invent facts about the client's business, prices, results or customers. If a specific would help and you do not have it, write around it.

Length: 45 to 75 seconds spoken (roughly 110 to 180 words) unless the brief says otherwise.

Shots: break the script into the few shots a client can film alone on a phone. Each shot's lines must be taken from the script, in order, covering all of it.

Directions: when you are told where and how the client can film, set each shot in one of their real places and say so by name. Use the place with the best light for talking shots, a quiet place when they speak, and never ask for anything they said must stay out of shot. Match the framing and movement to the format of the source video, so this week's videos do not all look the same. Write directions a nervous beginner can follow: where to stand, where the light should be, how to hold or prop the phone.`;

export async function draftScript(input: {
  clientId: string;
  userId: string;
  hook: string;
  format: VideoFormat;
  phrasesUse: string[];
  phrasesNever: string[];
  topicsAvoid: string[];
  offer: string;
  examplePosts: string[];
  sourceTranscript: string;
  brief: string;
  shootingContext?: string;
}): Promise<ScriptDraft> {
  const section = (title: string, body: string) => (body.trim() ? `## ${title}\n${body.trim()}\n` : "");
  // Exactly what the spec lists: hook, format, phrase bank, never-say list,
  // the offer, and two or three of the client's own posts. No names.
  const prompt = [
    section("Hook that worked (adapt it)", input.hook),
    section("Format", FORMATS[input.format]),
    section("Source video transcript (for structure only, do not copy)", input.sourceTranscript.slice(0, 6000)),
    section("Words and phrases this client uses", input.phrasesUse.join("\n")),
    section("Words and phrases this client never uses", input.phrasesNever.join("\n")),
    section("Topics this client will not talk about", input.topicsAvoid.join("\n")),
    section("The client's offer, in their words", input.offer),
    section("Posts that sound like this client", input.examplePosts.slice(0, 3).join("\n\n---\n\n")),
    section("Where and how this client can film (plan every shot around these)", input.shootingContext ?? ""),
    section("Brief from the team", input.brief),
  ].join("\n");
  return askStructured({
    purpose: "draft_script",
    clientId: input.clientId,
    userId: input.userId,
    system: DRAFT_SYSTEM,
    prompt,
    schema: draftSchema,
    effort: "high",
  });
}

// ---------------------------------------------------------------------------
// Build a voice profile from the onboarding call transcript
// ---------------------------------------------------------------------------
const voiceSchema = z.object({
  phrases_use: z.array(z.string()).describe("Distinctive words and phrases they actually said, verbatim. 10 to 30."),
  phrases_never: z.array(z.string()).describe("Words and phrases they said they dislike or would never use."),
  tone_notes: z.string().describe("Internal notes for writers: pace, humour, formality, how they explain things."),
  topics_avoid: z.array(z.string()).describe("Topics they said they will not talk about on camera."),
  offer: z.string().describe("Their best offer, in their own words as far as possible."),
  audience: z.string().describe("Who they are trying to reach, and what those people are doing when they see the video."),
  summary: z
    .string()
    .describe("One short page addressed to the client ('You...'), telling them how we heard them, so they can correct it."),
});
export type VoiceDraft = z.infer<typeof voiceSchema>;

const VOICE_SYSTEM = `You read the transcript of an onboarding call between a video agency and a new client (a small business owner) and build a profile of how the client talks, so scripts can be written in their voice.

Only use what the client actually said. Quote their phrasing exactly in the phrase lists; do not tidy it up and do not add phrases they did not say. Ignore the interviewer's words. If the transcript does not cover something, leave that field empty rather than guessing.

The summary is the one part the client will read. Write it to them, warmly and plainly, in a few short paragraphs: how they talk, what they care about, what they said they will never say or discuss. No flattery and no marketing language.`;

export async function extractVoice(input: { clientId: string; userId: string; transcript: string }): Promise<VoiceDraft> {
  return askStructured({
    purpose: "extract_voice",
    clientId: input.clientId,
    userId: input.userId,
    system: VOICE_SYSTEM,
    prompt: `Transcript of the onboarding call:\n\n${input.transcript}`,
    schema: voiceSchema,
    effort: "medium",
  });
}

// ---------------------------------------------------------------------------
// Find and classify the hook of a researched video (no client data involved)
// ---------------------------------------------------------------------------
const hookSchema = z.object({
  hook_text: z.string().describe("The first spoken sentence, or the on-screen text of the first two seconds."),
  hook_format: z.enum(HOOK_FORMATS),
  video_format: z.enum(VIDEO_FORMATS),
});
export type HookAnalysis = z.infer<typeof hookSchema>;

const HOOK_SYSTEM = `You are given the transcript or caption of a short-form video that performed unusually well. Identify its hook and classify it.

The hook is the first spoken sentence, or the on-screen text in the first two seconds, whichever the text gives you. Quote it exactly.

Hook format: question (opens by asking), bold_claim (a strong statement), contrarian (says the common advice is wrong), story_open (starts mid-story), number_list (promises a numbered list).
Video format: talking_head, voiceover_broll, skit, listicle, reaction. If the text does not make it clear, choose talking_head.`;

export async function analyzeHook(input: { userId: string | null; text: string }): Promise<HookAnalysis> {
  return askStructured({
    purpose: "analyze_hook",
    clientId: null,
    userId: input.userId,
    system: HOOK_SYSTEM,
    prompt: input.text.slice(0, 8000),
    schema: hookSchema,
    effort: "low",
  });
}
