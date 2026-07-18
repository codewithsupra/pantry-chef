import { Link } from "react-router";
import type { Route } from "./+types/home";
import { getCurrentUser } from "~/auth/auth.server";

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: "PantryChef — your kitchen, organized and intelligent" },
    {
      name: "description",
      content:
        "Track your pantry, rank your recipes by what you can cook right now, and let an AI agent do the busywork — add ingredients, plan meals, save recipes.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  return { isLoggedIn: user !== null };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { isLoggedIn } = loaderData;
  const cta = isLoggedIn ? "/app" : "/login";

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, oklch(98.5% 0.008 75), oklch(96.5% 0.015 60))" }}>
      {/* Hero */}
      <header className="max-w-5xl mx-auto px-8 pt-24 pb-16 text-center">
        <p className="text-sm font-semibold tracking-wide uppercase text-primary mb-5">PantryChef</p>
        <h1 className="font-serif text-stone-900 mb-6" style={{ fontSize: "clamp(2.4rem, 6vw, 4.2rem)", lineHeight: 1.08, letterSpacing: "-0.02em" }}>
          Cook what you have,
          <br />
          <em className="text-primary">not what you&rsquo;re missing.</em>
        </h1>
        <p className="text-stone-500 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          PantryChef tracks what&rsquo;s in your kitchen, ranks your recipes by how ready they are to
          cook right now, and puts an AI agent to work on the busywork.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link
            to={cta}
            className="px-7 py-3.5 rounded-2xl bg-primary text-white font-bold text-[15px] shadow-lg shadow-primary/25 hover:bg-primary-light hover:-translate-y-px transition-all"
          >
            {isLoggedIn ? "Open your kitchen →" : "Get started — it's free"}
          </Link>
          <a
            href="#how"
            className="px-7 py-3.5 rounded-2xl border border-stone-300 text-stone-600 font-semibold text-[15px] hover:border-primary hover:text-primary transition-colors"
          >
            See how it works
          </a>
        </div>
      </header>

      {/* Product vignette: agent transcript */}
      <section className="max-w-3xl mx-auto px-8 pb-24">
        <div className="rounded-3xl border border-stone-200 bg-white shadow-xl shadow-stone-200/60 overflow-hidden">
          <div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-stone-100">
            <span className="w-3 h-3 rounded-full bg-red-300" />
            <span className="w-3 h-3 rounded-full bg-amber-300" />
            <span className="w-3 h-3 rounded-full bg-emerald-300" />
            <span className="ml-3 text-xs text-stone-400 font-medium">Chef — your kitchen agent</span>
          </div>
          <div className="p-6 flex flex-col gap-4 text-[15px]">
            <div className="self-end bg-primary text-white rounded-2xl rounded-br-md px-4 py-2.5">
              Add the ingredients for a simple tomato pasta to my pantry
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] text-stone-400 italic">
                Adding the ingredients for simple tomato pasta to a new shelf
              </span>
              <span className="inline-flex items-center gap-1.5 text-[13px] rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 w-fit">
                ✓ Adding pantry items
              </span>
            </div>
            <div className="self-start bg-stone-50 border border-stone-200 rounded-2xl rounded-bl-md px-4 py-3 text-stone-700 leading-relaxed">
              Done — your new &ldquo;Pasta&rdquo; shelf has spaghetti, canned tomatoes, garlic, olive oil, onion,
              basil, and parmesan. You already had salt and pepper, so I skipped those.
            </div>
          </div>
        </div>
        <p className="text-center text-[13px] text-stone-400 mt-4">
          A real transcript — Chef reads your pantry, executes the change, and shows every step.
        </p>
      </section>

      {/* Feature trio */}
      <section id="how" className="max-w-5xl mx-auto px-8 pb-28">
        <h2 className="font-serif text-3xl text-stone-800 text-center mb-14">One kitchen, three superpowers</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            step="01"
            title="A pantry that stays tidy"
            body="Shelves and items with instant search, inline editing, and zero page reloads — and every action still works with JavaScript turned off."
          />
          <FeatureCard
            step="02"
            title="Know what's cookable"
            body="Discover ranks your saved recipes by how much of each is already on your shelves — and an AI pass catches near-matches and suggests real substitutions, like milk + lemon juice standing in for buttermilk."
          />
          <FeatureCard
            step="03"
            title="An agent that does the work"
            body="Chef plans meals, fills shelves, and writes recipes by calling real tools against your data — streaming each thought, action, and result to the screen as it happens."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-10 text-center text-sm text-stone-400">
        <p>
          Built with React Router v7, Prisma, and free-tier LLMs ·{" "}
          <Link to={cta} className="text-primary hover:underline">
            {isLoggedIn ? "Open the app" : "Sign in"}
          </Link>
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-7 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
      <p className="text-primary font-bold text-sm mb-3">{step}</p>
      <h3 className="font-serif text-xl text-stone-800 mb-2.5">{title}</h3>
      <p className="text-stone-500 text-[14.5px] leading-relaxed">{body}</p>
    </div>
  );
}
