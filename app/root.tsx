
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { Toaster } from "react-hot-toast";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "PantryChef" },
    {
      name: "description",
      content: "Track your pantry, rank recipes by what you can cook right now, and let an AI agent do the busywork.",
    },
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
      <body className="h-screen">
        {children}
        <Toaster position="bottom-right" />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
// Each top-level route (marketing home, the authenticated /app shell, login)
// owns its own header/nav — there's no shared chrome at the root, so a public
// visitor on "/" never sees the authenticated app's navigation.
export default function App() {
  return <Outlet />;
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
