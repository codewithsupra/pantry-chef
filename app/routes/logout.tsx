import { data } from "react-router";
import type { Route } from "./+types/logout";
import { destroySession, getSession } from "~/auth/sessions.server";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("cookie"));
  return data("ok", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}
export default function Logout() {
    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <h1 className="text-2xl font-bold mb-4">Logging out...</h1>
            <p className="text-gray-600">You are being logged out. Please wait.</p>
        </div>
    );
}
