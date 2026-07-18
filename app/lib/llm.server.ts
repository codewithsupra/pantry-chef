import { OpenRouter } from "@openrouter/sdk";
import type { z } from "zod";

const openrouter = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

/**
 * Free-tier models, tried in order. Free OpenRouter endpoints fail or stall
 * routinely (measured: gemma and llama-3.3 both intermittently return
 * "Provider returned error" with no retry-after; nemotron has been the
 * most consistently available in testing, so it goes first), so every
 * completion goes through a fallback chain under one overall deadline
 * rather than trusting any single model to be up.
 */
const MODEL_CHAIN = [
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
] as const;

type Message = { role: "system" | "user" | "assistant"; content: string };

async function attemptModel(model: string, messages: Message[], timeoutMs: number): Promise<string> {
  const res = await Promise.race([
    openrouter.chat.send({ chatRequest: { model, messages } }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${model} timed out`)), timeoutMs)),
  ]);
  const text = (res as any).choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.length === 0) throw new Error(`${model} returned empty content`);
  return text;
}

/**
 * Run a completion through the fallback chain. Each model gets at most
 * `perModelTimeoutMs`, and the chain as a whole never exceeds
 * `deadlineMs` from the moment of the call.
 */
export async function complete(
  messages: Message[],
  { deadlineMs = 14_000, perModelTimeoutMs = 10_000 }: { deadlineMs?: number; perModelTimeoutMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + deadlineMs;
  let lastError: unknown = new Error("No models attempted");

  for (const model of MODEL_CHAIN) {
    const remaining = deadline - Date.now();
    if (remaining <= 500) break;
    try {
      return await attemptModel(model, messages, Math.min(remaining, perModelTimeoutMs));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Completion that must produce JSON matching `schema`. Strips markdown
 * fences and leading prose, validates with zod, and treats a
 * non-conforming response as a failure (returns null rather than
 * propagating malformed data into the app).
 */
export async function completeJSON<T>(
  messages: Message[],
  schema: z.ZodType<T>,
  opts?: { deadlineMs?: number; perModelTimeoutMs?: number },
): Promise<T | null> {
  try {
    const text = await complete(messages, opts);
    const parsed = schema.safeParse(JSON.parse(extractJson(text)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("No JSON object found in model response");
  return text.slice(start, end + 1);
}
