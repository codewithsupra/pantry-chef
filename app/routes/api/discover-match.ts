import type { Route } from "./+types/discover-match";
import { getCurrentUser } from "~/auth/auth.server";
import { db } from "~/lib/db.server";
import { aiMatch } from "~/lib/pantry-recipe-matcher.server";

/**
 * Resource route for the AI-refined recipe ranking on /app/discover.
 *
 * Streams NDJSON instead of returning one JSON blob after the ~7s AI call
 * completes. Two earlier approaches both silently lost the result under
 * real network conditions: document-level defer via `<Await>` (the
 * `.data` request failed mid-stream with `ERR_INCOMPLETE_CHUNKED_ENCODING`)
 * and a plain awaited loader response (same truncation on the resource
 * route's own `.data` request). Both send zero bytes for the full ~7s
 * while the model call is in flight, then the entire payload at once —
 * a connection that looks idle that long gets killed somewhere in this
 * environment's network path. Emitting an immediate byte and then the
 * result as a second line (the same pattern already proven in
 * api/assistant.ts) keeps the connection visibly alive throughout.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      emit({ type: "start" });
      try {
        const [pantryItems, recipes] = await Promise.all([
          db.pantryItem.findMany({ where: { userId: user.id }, select: { name: true } }),
          db.recipe.findMany({
            where: { userId: user.id },
            select: { id: true, name: true, ingredients: { select: { name: true } } },
          }),
        ]);

        const matches = await aiMatch({
          pantryItems: pantryItems.map(p => p.name),
          recipes: recipes.map(r => ({ id: r.id, name: r.name, ingredients: r.ingredients.map(i => i.name) })),
        });

        emit({ type: "result", matches });
      } catch (error) {
        emit({ type: "error", message: error instanceof Error ? error.message : "Match failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
