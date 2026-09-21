/**
 * Liveness endpoint for Render's health check and uptime monitors.
 * Deliberately touches no database or auth so it stays cheap and fast.
 */
export function loader() {
  return new Response("ok", {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
