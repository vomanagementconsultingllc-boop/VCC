import "server-only";
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One place for every AI call the app makes.
 *
 * Rules (from the spec's security section):
 *   - a call sends only what its prompt needs: callers pass the exact text
 *     and images, nothing is added here
 *   - every call is logged with the client it was for and a SHA-256 of the
 *     input, never the input itself
 */
export const AI_MODEL = "claude-opus-5-5";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class AiUnavailableError extends Error {}

export type AiImage = { mediaType: "image/jpeg" | "image/png"; base64: string };

type Effort = "low" | "medium" | "high";

export async function askStructured<S extends z.ZodType>(options: {
  /** Short label for the log, e.g. "draft_script". */
  purpose: string;
  /** The client this call is about, or null for niche-level work with no client data. */
  clientId: string | null;
  /** The signed-in user who triggered it, or null for background jobs. */
  userId: string | null;
  system: string;
  prompt: string;
  images?: AiImage[];
  schema: S;
  effort?: Effort;
}): Promise<z.infer<S>> {
  if (!aiConfigured()) {
    throw new AiUnavailableError("AI is not set up yet. Add ANTHROPIC_API_KEY to turn it on.");
  }
  const images = options.images ?? [];
  const inputHash = createHash("sha256")
    .update(options.system)
    .update("\u0000")
    .update(options.prompt)
    .update(images.map((i) => i.base64).join("\u0000"))
    .digest("hex");
  const inputChars = options.system.length + options.prompt.length;

  const log = async (status: "ok" | "refused" | "error", outputChars: number) => {
    // Written with the service role so background jobs (no signed-in user)
    // are logged too. The log is append-only for everyone else.
    await createAdminClient().from("ai_calls").insert({
      client_id: options.clientId,
      purpose: options.purpose,
      model: AI_MODEL,
      input_hash: inputHash,
      input_chars: inputChars,
      output_chars: outputChars,
      status,
      created_by: options.userId,
    });
  };

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      // If a safety classifier declines the request, let the API retry it on
      // its default fallback model instead of failing outright.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: options.effort ?? "medium",
        format: betaZodOutputFormat(options.schema),
      },
      system: options.system,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((image) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: image.mediaType, data: image.base64 },
            })),
            { type: "text" as const, text: options.prompt },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      await log("refused", 0);
      throw new AiUnavailableError("The AI declined this request. Write this one by hand.");
    }
    const parsed = response.parsed_output;
    if (parsed == null) {
      await log("error", 0);
      throw new AiUnavailableError("The AI reply could not be read. Try again.");
    }
    await log("ok", JSON.stringify(parsed).length);
    return parsed as z.infer<S>;
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    await log("error", 0).catch(() => {});
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiUnavailableError("The AI key was rejected. Check ANTHROPIC_API_KEY.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiUnavailableError("The AI is busy right now. Try again in a minute.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiUnavailableError("The AI request failed. Try again.");
    }
    throw error;
  }
}
