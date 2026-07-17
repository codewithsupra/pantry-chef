
import {
  data,
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useNavigation,
  useResolvedPath,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { Toaster } from "react-hot-toast";
import { DiscoverIcon, HomeIcon, LoginIcon, RecipeBookIcon, SettingsIcon } from "./components/icons";
import classNames from "classnames";
import { getCurrentUser } from "./auth/auth.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Recipe App" },
    { name: "description", content: "A simple recipe app built with React Router." },
  ];
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600&family=Manrope:wght@400;500;600;700;800&display=swap",
  },
  { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
  { rel: "preload", href: "/app/entry.client.tsx", as: "script" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="md:flex h-screen">
        {children}
        <Toaster position="bottom-right" />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
export const loader=async({request}: Route.LoaderArgs)=>{
  const user=await getCurrentUser(request);
  return data({
    isLoggedIn:user!==null
  })

}
export default function App() {
  const { isLoggedIn } = useLoaderData<typeof loader>();
 
  

  

  return (
    <>
      <nav className="text-white md:w-16 md:flex flex-col justify-between" style={{ background: "oklch(27% 0.03 45)", borderRight: "1px solid oklch(20% 0.02 45)" }}>
        <ul className="flex md:flex-col gap-4">
          <AppNavLink to="/">
            <HomeIcon />
          </AppNavLink>
          <AppNavLink to="discover">
            <DiscoverIcon />
          </AppNavLink>
          {isLoggedIn && (
            <AppNavLink to="app">
              <RecipeBookIcon />
            </AppNavLink>
          )}
          <AppNavLink to="settings">
            <SettingsIcon />
          </AppNavLink>
        </ul>
        <ul>
          <li className="w-full flex justify-center relative group">
            <Link to={isLoggedIn ? "logout" : "login"}>
              <div style={{ color: "oklch(78% 0.02 60)", borderRadius: 12, margin: "2px auto", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <LoginIcon />
              </div>
            </Link>
            <div className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <div className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shadow-lg" style={{ background: "oklch(20% 0.02 45)", color: "oklch(90% 0.02 45)", border: "1px solid oklch(30% 0.03 45)" }}>
                {isLoggedIn ? "Log out" : "Log in"}
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2 h-2 rotate-45" style={{ background: "oklch(20% 0.02 45)", border: "1px solid oklch(30% 0.03 45)", borderRight: "none", borderTop: "none" }} />
            </div>
          </li>
        </ul>
      </nav>
      <div className="w-full md:w-[calc(100%-4rem)] overflow-y-auto h-full">
        <Outlet />
      </div>
    </>
  );
}

type AppNavLinkProps = {
  children: React.ReactNode;
  to: string;
  tooltip?: string;
};

function AppNavLink({ to, children, tooltip }: AppNavLinkProps) {
  const navigation = useNavigation();
  const absolutePath = useResolvedPath(to);
  const isLoading = navigation.state === 'loading' && navigation.location.pathname === absolutePath.pathname;
  return (
    <li className="w-full flex justify-center relative group">
      <NavLink to={to}>
        {({ isActive }) => (
          <div
            className={classNames(
              'flex items-center justify-center transition-colors duration-300',
              { "animate-pulse": isLoading }
            )}
            style={{
              color: isActive ? "oklch(76% 0.13 45)" : "oklch(78% 0.02 60)",
              background: isActive ? "oklch(38% 0.05 45)" : "transparent",
              borderRadius: 12,
              margin: "2px auto",
              width: 44,
              height: 44,
            }}
          >
            {children}
          </div>
        )}
      </NavLink>
      {tooltip && (
        <div className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <div
            className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shadow-lg"
            style={{
              background: "oklch(20% 0.02 45)",
              color: "oklch(90% 0.02 45)",
              border: "1px solid oklch(30% 0.03 45)",
            }}
          >
            {tooltip}
          </div>
          {/* arrow */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2 h-2 rotate-45"
            style={{ background: "oklch(20% 0.02 45)", border: "1px solid oklch(30% 0.03 45)", borderRight: "none", borderTop: "none" }}
          />
        </div>
      )}
    </li>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const isRouteError = isRouteErrorResponse(error);

  let title = is404 ? "404" : "Something went wrong";
  let description = is404
    ? "The page you're looking for doesn't exist."
    : isRouteError
    ? error.statusText || "An unexpected error occurred."
    : import.meta.env.DEV && error instanceof Error
    ? error.message
    : "An unexpected error occurred.";

  const stack =
    import.meta.env.DEV && error instanceof Error ? error.stack : undefined;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
      <span className="text-6xl">{is404 ? "🔍" : "⚠️"}</span>
      <h1 className="text-4xl font-bold text-gray-800">{title}</h1>
      <p className="text-gray-500 max-w-md">{description}</p>
      <Link
        to="/"
        className="mt-2 px-5 py-2 bg-primary text-white rounded-lg hover:bg-orange-500 transition-colors duration-300"
      >
        Go Home
      </Link>
      {stack && (
        <details className="mt-6 w-full max-w-2xl text-left">
          <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-600">
            Stack trace
          </summary>
          <pre className="mt-2 p-4 bg-gray-100 rounded-lg text-xs overflow-x-auto text-red-700">
            {stack}
          </pre>
        </details>
      )}
    </main>
  );
}
