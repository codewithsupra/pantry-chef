import classNames from "classnames";
import { NavLink, Outlet, useLoaderData } from "react-router";
import type { Route } from "./+types/app";
import { getCurrentUser } from "~/auth/auth.server";
import { requireLoggedInUserMiddleware } from "~/middleware/auth.middleware";

export const middleware = [requireLoggedInUserMiddleware];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  return { user };
}

export default function App() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <div className="flex flex-col h-full">
      <div className="px-14 flex items-center justify-between py-5 border-b border-stone-200">
        <h1 className="font-serif font-medium text-2xl text-stone-800 m-0">Recipes</h1>
        {user && (
          <p className="text-stone-500 text-sm">
            Welcome, <span className="font-semibold text-stone-700">{user.first_name} {user.last_name}</span>
          </p>
        )}
      </div>
      <nav className="px-14 flex gap-1 pt-3 pb-0 border-b border-stone-200">
        <RemixNavLink to="recipes">Recipes</RemixNavLink>
        <RemixNavLink to="pantry">Pantry</RemixNavLink>
      </nav>
      <div className="flex-1 overflow-y-auto min-h-0"><Outlet /></div>
    </div>
  );
}

function RemixNavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink to={to} className={({ isActive }) => classNames(
      'text-sm font-medium pb-3 px-3 transition-colors',
      isActive ? 'text-primary border-b-2 border-primary' : 'text-stone-500 hover:text-stone-800'
    )}>
      {children}
    </NavLink>
  );
}