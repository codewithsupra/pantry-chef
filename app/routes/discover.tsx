import React from "react";
import { Await, Link, useLoaderData } from "react-router";
import classNames from "classnames";
import type { Route } from "./+types/discover";
import { db } from "~/lib/db.server";
import { requireLoggedInUserMiddleware, userContext } from "~/middleware/auth.middleware";
import { baselineMatch, aiMatch, type RecipeMatch } from "~/lib/pantry-recipe-matcher.server";
import { TimeIcon, AiEditIcon } from "~/components/icons";

export const middleware = [requireLoggedInUserMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);

  const [pantryItems, recipes] = await Promise.all([
    db.pantryItem.findMany({ where: { userId: user.id }, select: { name: true } }),
    db.recipe.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        totalTime: true,
        imgUrl: true,
        ingredients: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const matchInput = {
    pantryItems: pantryItems.map(p => p.name),
    recipes: recipes.map(r => ({ id: r.id, name: r.name, ingredients: r.ingredients.map(i => i.name) })),
  };

  const baseline = baselineMatch(matchInput);
  // Not awaited: streamed to the client via <Await> so the baseline ranking
  // renders immediately instead of blocking the whole page on the AI call.
  const aiRanking = aiMatch(matchInput);

  return {
    recipes,
    baseline,
    aiRanking,
    pantryItemCount: pantryItems.length,
  };
}

export default function Discover() {
  const { recipes, baseline, aiRanking, pantryItemCount } = useLoaderData<typeof loader>();

  if (recipes.length === 0) {
    return (
      <EmptyState
        title="No recipes yet"
        body="Save a few recipes first, then come back here to see which ones you can cook right now."
      />
    );
  }

  if (pantryItemCount === 0) {
    return (
      <EmptyState
        title="Your pantry is empty"
        body="Add a few items to your pantry and this page will rank your recipes by how ready they are to cook."
      />
    );
  }

  const byId = new Map(recipes.map(r => [r.id, r]));

  return (
    <div className="px-14 py-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-serif text-stone-800 mb-1">What can I cook?</h1>
      <p className="text-stone-500 text-sm mb-8">
        Ranked by how much of each recipe is already in your pantry.
      </p>

      <MatchList matches={baseline} byId={byId} aiRanked={false} />

      <React.Suspense fallback={<AiRankingPending />}>
        <Await resolve={aiRanking} errorElement={null}>
          {resolved =>
            resolved ? (
              <div className="mt-10 pt-8 border-t border-stone-200">
                <div className="flex items-center gap-2 mb-4 text-primary">
                  <AiEditIcon />
                  <h2 className="text-lg font-semibold text-stone-800">
                    Refined with semantic matching + substitutions
                  </h2>
                </div>
                <MatchList matches={resolved} byId={byId} aiRanked />
              </div>
            ) : null
          }
        </Await>
      </React.Suspense>
    </div>
  );
}

function AiRankingPending() {
  return (
    <div className="mt-10 pt-8 border-t border-stone-200 flex items-center gap-2 text-stone-400 text-sm">
      <AiEditIcon />
      <span>Looking for substitutions and near-matches…</span>
    </div>
  );
}

function MatchList({
  matches,
  byId,
  aiRanked,
}: {
  matches: RecipeMatch[];
  byId: Map<string, { id: string; name: string; totalTime: string; imgUrl: string }>;
  aiRanked: boolean;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {matches.map(match => {
        const recipe = byId.get(match.recipeId);
        if (!recipe) return null;
        return (
          <li key={`${aiRanked ? "ai" : "base"}-${match.recipeId}`}>
            <RecipeMatchCard recipe={recipe} match={match} />
          </li>
        );
      })}
    </ul>
  );
}

function RecipeMatchCard({
  recipe,
  match,
}: {
  recipe: { id: string; name: string; totalTime: string; imgUrl: string };
  match: RecipeMatch;
}) {
  return (
    <Link
      to={`/app/recipes/${recipe.id}`}
      className="flex gap-4 p-4 rounded-lg border border-stone-200 hover:border-primary transition-colors"
    >
      <div className="w-16 h-16 rounded-full overflow-hidden shrink-0">
        <img src={recipe.imgUrl} alt={recipe.name} className="object-cover h-full w-full" />
      </div>
      <div className="grow min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-stone-800 truncate">{recipe.name}</h3>
          <ReadinessBadge readiness={match.readiness} />
        </div>
        <div className="flex items-center gap-1 text-stone-400 text-sm mt-0.5">
          <TimeIcon />
          <span>{recipe.totalTime}</span>
        </div>
        {match.missingIngredients.length > 0 && (
          <p className="text-sm text-stone-500 mt-2">
            Missing: {match.missingIngredients.join(", ")}
          </p>
        )}
        {match.substitutions.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {match.substitutions.map((sub, i) => (
              <li key={i} className="text-sm text-primary">
                Swap <span className="font-medium">{sub.missing}</span> → {sub.suggestion}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}

function ReadinessBadge({ readiness }: { readiness: number }) {
  return (
    <span
      className={classNames(
        "shrink-0 text-xs font-semibold px-2 py-1 rounded-full",
        readiness >= 80
          ? "bg-emerald-100 text-emerald-700"
          : readiness >= 40
            ? "bg-amber-100 text-amber-700"
            : "bg-stone-100 text-stone-500",
      )}
    >
      {readiness}% ready
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center px-8">
      <h1 className="text-2xl font-serif text-stone-800 mb-2">{title}</h1>
      <p className="text-stone-500 max-w-sm">{body}</p>
    </div>
  );
}
