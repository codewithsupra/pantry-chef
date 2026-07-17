import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";

const openrouter = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

export type MatchInput = {
  pantryItems: string[];
  recipes: { id: string; name: string; ingredients: string[] }[];
};

export type RecipeMatch = {
  recipeId: string;
  readiness: number;
  haveIngredients: string[];
  missingIngredients: string[];
  substitutions: { missing: string; suggestion: string }[];
};

const matchSchema = z.object({
  matches: z.array(
    z.object({
      recipeId: z.string(),
      readiness: z.number().min(0).max(100),
      haveIngredients: z.array(z.string()),
      missingIngredients: z.array(z.string()),
      substitutions: z
        .array(z.object({ missing: z.string(), suggestion: z.string() }))
        .default([]),
    }),
  ),
});

/**
 * Deterministic substring-overlap ranking. Renders instantly while the AI
 * ranking streams in behind it, and is what the UI falls back to if the AI
 * call fails or returns something unusable.
 */
export function baselineMatch({ pantryItems, recipes }: MatchInput): RecipeMatch[] {
  const pantryNorm = pantryItems.map(p => p.toLowerCase().trim()).filter(Boolean);

  return recipes
    .map(recipe => {
      const have = recipe.ingredients.filter(ingredient => {
        const norm = ingredient.toLowerCase();
        return pantryNorm.some(p => norm.includes(p) || p.includes(norm));
      });
      const missing = recipe.ingredients.filter(i => !have.includes(i));
      const readiness = recipe.ingredients.length
        ? Math.round((have.length / recipe.ingredients.length) * 100)
        : 0;

      return {
        recipeId: recipe.id,
        readiness,
        haveIngredients: have,
        missingIngredients: missing,
        substitutions: [],
      };
    })
    .sort((a, b) => b.readiness - a.readiness);
}

/**
 * Semantic ranking via LLM: matches ingredients the way a person would
 * ("chicken breast" satisfies a recipe that calls for "chicken") and
 * proposes real substitutions for what's missing, using only what's
 * already in the pantry. Returns null on any failure so the caller can
 * keep serving the baseline instead of breaking the page.
 */
const AI_MATCH_TIMEOUT_MS = 15_000;

export async function aiMatch(input: MatchInput): Promise<RecipeMatch[] | null> {
  if (input.recipes.length === 0) return [];

  try {
    // Bounded explicitly rather than relying on the SSR stream's own
    // timeout: that timeout aborts the whole page, not just this
    // <Suspense> boundary, so a slow model call must never be allowed to
    // outlive it. gpt-4o-mini specifically (not a reasoning model): a
    // chain-of-thought model was measured taking 30s+ on this prompt,
    // which is not a workable latency for an interactive page.
    const res = await Promise.race([
      openrouter.chat.send({
        chatRequest: {
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: buildPrompt(input) }],
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI match timed out")), AI_MATCH_TIMEOUT_MS),
      ),
    ]);
    const text = (res as any).choices[0]?.message?.content ?? "";
    const parsed = matchSchema.safeParse(JSON.parse(extractJson(text)));
    if (!parsed.success) return null;

    // Guard against the model inventing recipe ids that don't exist, and
    // recompute readiness ourselves from the have/missing counts instead of
    // trusting the model's own percentage — LLMs are unreliable at exact
    // arithmetic even when their ingredient categorization is correct.
    const validIds = new Set(input.recipes.map(r => r.id));
    const matches = parsed.data.matches
      .filter(m => validIds.has(m.recipeId))
      .map(m => {
        const total = m.haveIngredients.length + m.missingIngredients.length;
        return { ...m, readiness: total > 0 ? Math.round((m.haveIngredients.length / total) * 100) : 0 };
      });
    return matches.sort((a, b) => b.readiness - a.readiness);
  } catch {
    return null;
  }
}

function buildPrompt({ pantryItems, recipes }: MatchInput): string {
  const recipeList = recipes
    .map(r => `- id: ${r.id}, name: "${r.name}", ingredients: [${r.ingredients.join(", ")}]`)
    .join("\n");

  return `You are a kitchen assistant. Given pantry items and a list of recipes with their ingredients, determine how "ready to cook" each recipe is right now.

Match ingredients semantically, not by exact string: "chicken breast" satisfies a recipe that calls for "chicken", "AP flour" satisfies "flour", plural/singular and brand names don't matter.

For recipes missing 1-2 ingredients, suggest one real, sensible substitution using ONLY items already in the pantry, if a reasonable one exists (e.g. missing buttermilk + pantry has milk and lemon juice -> suggest that combination). Omit the substitution for an ingredient if nothing in the pantry reasonably covers it.

Pantry items: ${pantryItems.join(", ") || "(empty)"}

Recipes:
${recipeList}

Return ONLY valid JSON in exactly this shape, no markdown fences, no commentary:
{"matches":[{"recipeId":"...","readiness":0-100,"haveIngredients":["..."],"missingIngredients":["..."],"substitutions":[{"missing":"...","suggestion":"..."}]}]}`;
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in AI response");
  return text.slice(start, end + 1);
}
