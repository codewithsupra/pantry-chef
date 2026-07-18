import type { Route } from "./+types/assistant";
import { getCurrentUser } from "~/auth/auth.server";
import { runAgent } from "~/lib/assistant/agent.server";

/**
 * Streaming endpoint for the kitchen assistant. Emits one JSON object per
 * line (NDJSON) as the agent thinks, calls tools, and answers — the
 * client renders each step the moment it happens instead of staring at a
 * spinner for the whole run.
 */
export async function action({ request }: Route.ActionArgs) {
  const user = await getCurrentUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { message } = await request.json();
  if (typeof message !== "string" || !message.trim() || message.length > 2000) {
    return new Response("Bad request", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await runAgent(user.id, message.trim(), emit);
      } catch (error) {
        emit({ type: "error", message: error instanceof Error ? error.message : "Agent failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
