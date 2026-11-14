import "server-only";
import { requireEnv } from "@/lib/env";

/**
 * Pull an onboarding call transcript from Fireflies. The call is the voice
 * interview: there is no separate recording step.
 *
 * NOTE: written against Fireflies' documented GraphQL API, not yet run
 * against a live account.
 */
export async function fetchFirefliesTranscript(meetingId: string): Promise<{ title: string; text: string }> {
  const res = await fetch("https://api.fireflies.ai/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${requireEnv("FIREFLIES_API_KEY")}` },
    body: JSON.stringify({
      query: "query Transcript($id: String!) { transcript(id: $id) { title sentences { speaker_name text } } }",
      variables: { id: meetingId },
    }),
  });
  if (!res.ok) throw new Error(`Fireflies returned ${res.status}`);
  const json = (await res.json()) as {
    data?: { transcript?: { title?: string; sentences?: Array<{ speaker_name?: string; text?: string }> } };
    errors?: Array<{ message?: string }>;
  };
  const transcript = json.data?.transcript;
  if (!transcript?.sentences?.length) {
    throw new Error(json.errors?.[0]?.message ?? "No transcript found for that meeting.");
  }
  // Merge consecutive lines from the same speaker so it reads as a conversation.
  const lines: string[] = [];
  let speaker = "";
  for (const s of transcript.sentences) {
    const name = s.speaker_name?.trim() || "Speaker";
    const text = s.text?.trim();
    if (!text) continue;
    if (name === speaker) lines[lines.length - 1] += ` ${text}`;
    else lines.push(`${name}: ${text}`);
    speaker = name;
  }
  return { title: transcript.title ?? "", text: lines.join("\n") };
}

/** Accept a meeting id or a Fireflies link (app.fireflies.ai/view/Title::ID). */
export function parseFirefliesId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const fromUrl = /::([A-Za-z0-9]+)/.exec(trimmed);
  if (fromUrl) return fromUrl[1];
  return /^[A-Za-z0-9]+$/.test(trimmed) ? trimmed : null;
}
