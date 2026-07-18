import { z } from "zod";
import { complete, extractJson } from "~/lib/llm.server";
import { runTool, toolCatalogForPrompt } from "./tools.server";

/**
 * A hand-rolled ReAct-style agent loop. The model plans one step at a
 * time by emitting a JSON action; the server executes the tool (scoped to
 * the authenticated user), feeds the observation back, and repeats until
 * the model finishes or hits the iteration cap.
 *
 * The JSON action protocol (rather than provider-native tool calling) is
 * deliberate: this app runs exclusively on free-tier models, where native
 * function-calling support is inconsistent or absent. A strict
 * emit-JSON/validate/observe loop works on any chat model and keeps the
 * whole mechanism inspectable.
 */

const actionSchema = z.union([
  z.object({
    thought: z.string(),
    tool: z.string(),
    args: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    thought: z.string().optional(),
    answer: z.string(),
  }),
]);

export type AgentEvent =
  | { type: "thought"; text: string }
  | { type: "tool_call"; tool: string; args: unknown }
  | { type: "tool_result"; tool: string; result: unknown }
  | { type: "answer"; text: string }
  | { type: "error"; message: string };

const MAX_STEPS = 6;

function systemPrompt(): string {
  return `You are Chef, the kitchen assistant inside PantryChef. You help the user manage their pantry, plan meals, and create recipes by using tools.

Available tools:
${toolCatalogForPrompt()}

Protocol — every reply must be EXACTLY ONE JSON object, no markdown fences, no text outside the JSON:
- To use a tool: {"thought": "why this step", "tool": "tool_name", "args": {...}}
- To finish:     {"thought": "optional", "answer": "final reply to the user, plain text, may use simple markdown lists"}

Rules:
- Look before you act: read the pantry or recipes before modifying them when the request depends on current state.
- Use at most ${MAX_STEPS} steps; be efficient.
- Only claim you did something if a tool result confirms it.
- If a tool returns an error, adapt or explain the problem in your answer.
- Ingredient amounts should be realistic; recipes should be genuinely cookable.`;
}

export async function runAgent(
  userId: string,
  userMessage: string,
  emit: (event: AgentEvent) => void | Promise<void>,
): Promise<void> {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: userMessage },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    let raw: string;
    try {
      raw = await complete(messages, { deadlineMs: 20_000, perModelTimeoutMs: 12_000 });
    } catch {
      await emit({ type: "error", message: "The model is unavailable right now — try again in a moment." });
      return;
    }

    let action: z.infer<typeof actionSchema> | null = null;
    try {
      const parsed = actionSchema.safeParse(JSON.parse(extractJson(raw)));
      if (parsed.success) action = parsed.data;
    } catch {
      /* fall through to malformed handling */
    }

    if (!action) {
      // One retry with the protocol restated: free models occasionally
      // wrap the JSON in prose despite instructions.
      messages.push(
        { role: "assistant", content: raw },
        { role: "user", content: "That was not a single valid JSON action object. Reply again with EXACTLY one JSON object per the protocol." },
      );
      continue;
    }

    if ("answer" in action) {
      if (action.thought) await emit({ type: "thought", text: action.thought });
      await emit({ type: "answer", text: action.answer });
      return;
    }

    await emit({ type: "thought", text: action.thought });
    await emit({ type: "tool_call", tool: action.tool, args: action.args ?? {} });

    const result = await runTool(action.tool, userId, action.args ?? {});
    await emit({ type: "tool_result", tool: action.tool, result });

    messages.push(
      { role: "assistant", content: JSON.stringify(action) },
      { role: "user", content: `Tool result: ${JSON.stringify(result)}` },
    );
  }

  await emit({
    type: "error",
    message: `Stopped after ${MAX_STEPS} steps without a final answer. Partial work above may have been applied.`,
  });
}
