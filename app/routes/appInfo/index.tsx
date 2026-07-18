import { Link } from "react-router";
import type { Route } from "./+types/index";
import { db } from "~/lib/db.server";
import { userContext } from "~/middleware/auth.middleware";
import { baselineMatch } from "~/lib/pantry-recipe-matcher.server";
import { TimeIcon } from "~/components/icons";

export function meta(): ReturnType<Route.MetaFunction> {
  return [{ title: "Kitchen · PantryChef" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);

  const [shelves, itemCount, recipes] = await Promise.all([
    db.pantryShelf.count({ where: { userId: user.id } }),
    db.pantryItem.count({ where: { userId: user.id } }),
    db.recipe.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        totalTime: true,
        imgUrl: true,
        ingredients: { select: { name: true } },
      },
    }),
  ]);

  const pantryItems = await db.pantryItem.findMany({ where: { userId: user.id }, select: { name: true } });
  const ranked = baselineMatch({
    pantryItems: pantryItems.map(p => p.name),
    recipes: recipes.map(r => ({ id: r.id, name: r.name, ingredients: r.ingredients.map(i => i.name) })),
  });
  const top = ranked[0] ? recipes.find(r => r.id === ranked[0].recipeId) : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return {
    firstName: user.first_name,
    greeting,
    stats: { shelves, items: itemCount, recipes: recipes.length },
    topPick: top && ranked[0] ? { id: top.id, name: top.name, totalTime: top.totalTime, imgUrl: top.imgUrl, readiness: ranked[0].readiness } : null,
  };
}

export default function KitchenDashboard({ loaderData }: Route.ComponentProps) {
  const { firstName, greeting, stats, topPick } = loaderData;

  return (
    <div className="px-14 py-11 max-w-4xl">
      <h1 className="font-serif font-medium text-[40px] tracking-tight text-stone-800 mb-1.5">
        {greeting}, {firstName}.
      </h1>
      <p className="text-[15px] text-stone-400 mb-10">Here&rsquo;s where your kitchen stands.</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10 max-w-xl">
        <Stat label={stats.shelves === 1 ? "shelf" : "shelves"} value={stats.shelves} to="/app/pantry" />
        <Stat label={stats.items === 1 ? "pantry item" : "pantry items"} value={stats.items} to="/app/pantry" />
        <Stat label={stats.recipes === 1 ? "recipe" : "recipes"} value={stats.recipes} to="/app/recipes" />
      </div>

      {/* Tonight's pick */}
      {topPick ? (
        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400 mb-3">Closest to cookable</h2>
          <Link
            to={`/app/recipes/${topPick.id}`}
            className="flex gap-4 items-center p-5 rounded-2xl border border-stone-200 bg-stone-50 hover:border-primary transition-colors max-w-xl"
          >
            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0">
              <img src={topPick.imgUrl} alt={topPick.name} className="object-cover w-full h-full" />
            </div>
            <div className="grow">
              <h3 className="font-serif text-xl text-stone-800">{topPick.name}</h3>
              <div className="flex items-center gap-1 text-stone-400 text-sm mt-0.5">
                <TimeIcon />
                <span>{topPick.totalTime}</span>
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
              {topPick.readiness}% ready
            </span>
          </Link>
        </section>
      ) : null}

      {/* Quick actions */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400 mb-3">Jump back in</h2>
        <div className="grid gap-4 md:grid-cols-3 max-w-3xl">
          <ActionCard to="/app/assistant" title="Ask Chef" body="Plan a meal, fill a shelf, or draft a recipe — the agent does the clicking." accent />
          <ActionCard to="/app/discover" title="What can I cook?" body="Your recipes ranked by pantry readiness, with AI substitutions." />
          <ActionCard to="/app/pantry" title="Tend the pantry" body="Add what you bought, clear what you used." />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-2xl border border-stone-200 bg-white p-5 hover:border-primary transition-colors">
      <p className="font-serif text-4xl text-stone-800">{value}</p>
      <p className="text-[13px] text-stone-400 mt-1">{label}</p>
    </Link>
  );
}

function ActionCard({ to, title, body, accent }: { to: string; title: string; body: string; accent?: boolean }) {
  return (
    <Link
      to={to}
      className={
        accent
          ? "rounded-2xl p-5 bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary-light transition-colors"
          : "rounded-2xl p-5 border border-stone-200 bg-white hover:border-primary transition-colors"
      }
    >
      <h3 className={accent ? "font-serif text-lg mb-1" : "font-serif text-lg text-stone-800 mb-1"}>{title}</h3>
      <p className={accent ? "text-[13.5px] opacity-90 leading-relaxed" : "text-[13.5px] text-stone-500 leading-relaxed"}>{body}</p>
    </Link>
  );
}
