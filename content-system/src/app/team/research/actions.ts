"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AiUnavailableError, aiConfigured } from "@/lib/ai/client";
import { analyzeHook, draftScript, extractVoice } from "@/lib/ai/scripts";
import { fetchFirefliesTranscript, parseFirefliesId } from "@/lib/fireflies";
import { pullTikTokOutliers } from "@/lib/research/apify";
import { intOrNull, isUuid, tags, text, type ActionState } from "@/lib/forms";
import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];
const HOOK_FORMATS: Enums["hook_format"][] = ["question", "bold_claim", "contrarian", "story_open", "number_list"];
const PLATFORMS = ["tiktok", "instagram", "youtube", "other"];
const aiMessage = (error: unknown, fallback: string) => (error instanceof AiUnavailableError ? error.message : fallback);

// ---------------------------------------------------------------------------
// Research board
// ---------------------------------------------------------------------------
export async function addResearchItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const url = text(formData, "source_url");
  const platform = text(formData, "platform");
  const views = intOrNull(formData, "view_count");
  if (!/^https?:\/\//.test(url)) return { error: "Paste the link to the video." };
  if (views == null || views < 0) return { error: "Enter the view count." };
  const transcript = text(formData, "transcript");
  const posted = text(formData, "posted_at");

  let hookText = text(formData, "hook_text");
  let format: Enums["video_format"] | null = null;
  // Niche-level text only: no client data goes into this call.
  if (!hookText && transcript && aiConfigured()) {
    try {
      const analysis = await analyzeHook({ userId: user.id, text: transcript });
      hookText = analysis.hook_text;
      format = analysis.video_format;
    } catch {
      // The item is still worth saving without it.
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("research_items").insert({
    source_url: url,
    platform: PLATFORMS.includes(platform) ? platform : "other",
    creator_handle: text(formData, "creator_handle").replace(/^@/, ""),
    follower_count: intOrNull(formData, "follower_count"),
    view_count: views,
    creator_median_views: intOrNull(formData, "creator_median_views"),
    posted_at: /^\d{4}-\d{2}-\d{2}$/.test(posted) ? posted : null,
    transcript,
    hook_text: hookText,
    format_label: format,
    niche_tags: tags(formData, "niche_tags"),
  });
  if (error) return { error: error.code === "23505" ? "That video is already on the board." : "Could not save. Try again." };
  refresh();
  return { ok: "Added to the board." };
}

export async function setResearchStatus(formData: FormData): Promise<void> {
  await requireStaff();
  const id = text(formData, "item_id");
  const status = text(formData, "status") as Enums["research_status"];
  if (!isUuid(id) || !["new", "worth_copying", "dismissed"].includes(status)) return;
  const supabase = await createClient();
  await supabase.from("research_items").update({ status }).eq("id", id);
  refresh();
}

export async function saveHook(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const itemId = text(formData, "item_id");
  const hookText = text(formData, "text");
  const formatType = text(formData, "format_type") as Enums["hook_format"];
  if (!hookText) return { error: "Write the hook text." };
  if (!HOOK_FORMATS.includes(formatType)) return { error: "Pick a hook type." };
  const supabase = await createClient();
  let nicheTags = tags(formData, "niche_tags");
  if (isUuid(itemId)) {
    const { data: item } = await supabase.from("research_items").select("niche_tags").eq("id", itemId).maybeSingle();
    if (item && nicheTags.length === 0) nicheTags = item.niche_tags;
    await supabase.from("research_items").update({ status: "worth_copying", hook_text: hookText }).eq("id", itemId);
  }
  const { error } = await supabase.from("hooks").insert({
    text: hookText,
    format_type: formatType,
    research_item_id: isUuid(itemId) ? itemId : null,
    niche_tags: nicheTags,
  });
  if (error) return { error: "Could not save the hook." };
  refresh();
  return { ok: "Saved to the hook library." };
}

/** One click: turn a research item or a library hook into a script for a client. */
export async function turnIntoScript(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const clientId = text(formData, "client_id");
  const itemId = text(formData, "item_id");
  const hookId = text(formData, "hook_id");
  if (!isUuid(clientId)) return { error: "Pick a client." };

  const supabase = await createClient();
  let hook = "";
  let format: Enums["video_format"] = "talking_head";
  let researchId: string | null = isUuid(itemId) ? itemId : null;
  if (isUuid(hookId)) {
    const { data } = await supabase.from("hook_rankings").select("text, research_item_id, format_label").eq("id", hookId).maybeSingle();
    if (data) {
      hook = data.text ?? "";
      researchId = data.research_item_id ?? researchId;
      if (data.format_label) format = data.format_label;
    }
  }
  if (researchId) {
    const { data } = await supabase.from("research_items").select("hook_text, format_label").eq("id", researchId).maybeSingle();
    if (data) {
      hook = hook || data.hook_text;
      if (data.format_label) format = data.format_label;
    }
  }

  const { data: script, error } = await supabase
    .from("scripts")
    .insert({ client_id: clientId, title: hook ? hook.slice(0, 80) : "Untitled script", hook, format, stage: "research" })
    .select("id")
    .single();
  if (error || !script) return { error: "Could not create the script." };
  await supabase
    .from("script_internal")
    .update({ hook_id: isUuid(hookId) ? hookId : null, source_research_item_id: researchId })
    .eq("script_id", script.id);
  redirect(`/team/scripts/${script.id}`);
}

/** Pull outliers for one niche right now. Sends the scraper niche keywords only. */
export async function pullNiche(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const niche = tags(formData, "niche")[0];
  if (!niche) return { error: "Pick a niche." };
  if (!process.env.APIFY_TOKEN) return { error: "Add APIFY_TOKEN to turn on research pulls. You can still add videos by hand." };
  let outliers;
  try {
    outliers = await pullTikTokOutliers([niche]);
  } catch {
    return { error: "The research pull failed. Try again, or add videos by hand." };
  }
  if (outliers.length === 0) return { ok: `No outliers found for "${niche}" this time.` };
  const supabase = await createClient();
  const { error } = await supabase.from("research_items").upsert(
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
    })),
    { onConflict: "source_url", ignoreDuplicates: true },
  );
  if (error) return { error: "Found outliers but could not save them." };
  refresh();
  return { ok: `Added ${outliers.length} outlier${outliers.length === 1 ? "" : "s"} for "${niche}".` };
}

// ---------------------------------------------------------------------------
// Script editor: hook picker, AI draft, review
// ---------------------------------------------------------------------------
export async function pickHook(formData: FormData): Promise<void> {
  await requireStaff();
  const scriptId = text(formData, "script_id");
  const hookId = text(formData, "hook_id");
  if (!isUuid(scriptId) || !isUuid(hookId)) return;
  const supabase = await createClient();
  const { data: hook } = await supabase.from("hook_rankings").select("text, research_item_id, format_label").eq("id", hookId).maybeSingle();
  if (!hook?.text) return;
  await supabase
    .from("scripts")
    .update({ hook: hook.text, ...(hook.format_label ? { format: hook.format_label } : {}) })
    .eq("id", scriptId);
  await supabase
    .from("script_internal")
    .update({ hook_id: hookId, source_research_item_id: hook.research_item_id })
    .eq("script_id", scriptId);
  refresh();
}

export async function draftWithAi(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const scriptId = text(formData, "script_id");
  if (!isUuid(scriptId)) return { error: "Unknown script." };
  const supabase = await createClient();
  const { data: script } = await supabase.from("scripts").select("id, client_id, hook, format, stage").eq("id", scriptId).maybeSingle();
  if (!script) return { error: "This script no longer exists." };
  if (script.stage !== "research" && script.stage !== "scripted") return { error: "Only a draft can be rewritten by AI." };
  if (!script.hook.trim()) return { error: "Pick or write a hook first. The draft is built from it." };

  const [{ data: voice }, { data: internal }, { data: existingShots }] = await Promise.all([
    supabase.from("voice_profiles").select("phrases_use, phrases_never, topics_avoid, offer, example_posts").eq("client_id", script.client_id).maybeSingle(),
    supabase.from("script_internal").select("source_research_item_id").eq("script_id", scriptId).maybeSingle(),
    supabase.from("shots").select("id").eq("script_id", scriptId),
  ]);
  const { data: source } = internal?.source_research_item_id
    ? await supabase.from("research_items").select("transcript").eq("id", internal.source_research_item_id).maybeSingle()
    : { data: null };

  let draft;
  try {
    draft = await draftScript({
      clientId: script.client_id,
      userId: user.id,
      hook: script.hook,
      format: script.format,
      phrasesUse: voice?.phrases_use ?? [],
      phrasesNever: voice?.phrases_never ?? [],
      topicsAvoid: voice?.topics_avoid ?? [],
      offer: voice?.offer ?? "",
      examplePosts: Array.isArray(voice?.example_posts) ? (voice.example_posts as string[]) : [],
      sourceTranscript: source?.transcript ?? "",
      brief: text(formData, "brief"),
    });
  } catch (error) {
    return { error: aiMessage(error, "The draft failed. Try again, or write it by hand.") };
  }

  // Mark it as an unreviewed AI draft BEFORE the words land: the database
  // then refuses to send it to the client until someone reviews it.
  await supabase.from("script_internal").update({ ai_drafted: true, reviewed_by: null, reviewed_at: null }).eq("script_id", scriptId);
  const { error } = await supabase
    .from("scripts")
    .update({ title: draft.title.slice(0, 200), hook: draft.hook, body: draft.body, stage: "scripted" })
    .eq("id", scriptId);
  if (error) return { error: "The draft was written but could not be saved." };
  if (!existingShots?.length) {
    await supabase.from("shots").insert(
      draft.shots.map((shot, i) => ({
        script_id: scriptId,
        client_id: script.client_id,
        shot_number: i + 1,
        instruction: shot.instruction.slice(0, 300),
        lines: shot.lines,
        framing: shot.framing.slice(0, 300),
        where_to_look: shot.where_to_look.slice(0, 300),
        orientation: shot.orientation,
        min_duration_seconds: shot.min_seconds,
      })),
    );
  }
  refresh();
  return { ok: "Draft written. Read it, edit it, then mark it reviewed before sending." };
}

export async function markReviewed(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const scriptId = text(formData, "script_id");
  if (!isUuid(scriptId)) return;
  const supabase = await createClient();
  await supabase.from("script_internal").update({ reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("script_id", scriptId);
  refresh();
}

// ---------------------------------------------------------------------------
// Voice profile: transcript import and extraction
// ---------------------------------------------------------------------------
export async function importFireflies(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const clientId = text(formData, "client_id");
  const meetingId = parseFirefliesId(text(formData, "meeting"));
  if (!isUuid(clientId)) return { error: "Unknown client." };
  if (!meetingId) return { error: "Paste the Fireflies meeting link or id." };
  if (!process.env.FIREFLIES_API_KEY) return { error: "Add FIREFLIES_API_KEY to import from Fireflies, or paste the transcript below." };
  let transcript;
  try {
    transcript = await fetchFirefliesTranscript(meetingId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not fetch that transcript." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("voice_profiles")
    .upsert({ client_id: clientId, interview_transcript: transcript.text, interview_source: `fireflies:${meetingId}` });
  if (error) return { error: "Fetched the transcript but could not save it." };
  refresh();
  return { ok: `Imported "${transcript.title || "transcript"}". Now build the voice profile from it.` };
}

export async function buildVoiceProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const clientId = text(formData, "client_id");
  if (!isUuid(clientId)) return { error: "Unknown client." };
  const supabase = await createClient();
  const { data: voice } = await supabase.from("voice_profiles").select("interview_transcript").eq("client_id", clientId).maybeSingle();
  if (!voice?.interview_transcript.trim()) return { error: "Save or import the call transcript first." };
  let draft;
  try {
    draft = await extractVoice({ clientId, userId: user.id, transcript: voice.interview_transcript });
  } catch (error) {
    return { error: aiMessage(error, "Could not build the profile. Try again.") };
  }
  const { error } = await supabase
    .from("voice_profiles")
    .update({
      phrases_use: draft.phrases_use,
      phrases_never: draft.phrases_never,
      tone_notes: draft.tone_notes,
      topics_avoid: draft.topics_avoid,
      offer: draft.offer,
      audience: draft.audience,
      summary: draft.summary,
    })
    .eq("client_id", clientId);
  if (error) return { error: "Built the profile but could not save it." };
  refresh();
  return { ok: "Voice profile filled in from the transcript. Check it, then save." };
}

