/**
 * Proves the pantry actions work as plain HTML forms with zero JavaScript:
 * a raw application/x-www-form-urlencoded POST to the exact route the page
 * renders (not the `.data` single-fetch endpoint fetchers use), using a
 * real signed session cookie built the same way the app itself builds one.
 * This is the literal mechanism a no-JS browser falls back to.
 *
 * Run: npx tsx scripts/verify-no-js.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getSession, commitSession } from "../app/auth/sessions.server";

const BASE = process.env.ORIGIN ?? "http://localhost:3001";
const db = new PrismaClient();

async function main() {
  const user = await db.user.findFirst({ where: { email: "supratim347@gmail.com" } });
  if (!user) throw new Error("Seed a user first (see prisma/seed.ts).");

  const shelf = await db.pantryShelf.findFirst({ where: { userId: user.id } });
  if (!shelf) throw new Error("Seed a pantry shelf first.");

  const session = await getSession();
  session.set("userId", user.id);
  const cookie = await commitSession(session);

  const newName = `No-JS rename ${Date.now()}`;
  const body = new URLSearchParams({
    _action: "saveShelfName",
    shelfId: shelf.id,
    shelfName: newName,
  });

  console.log(`POST /app/pantry (application/x-www-form-urlencoded, no fetcher headers)`);
  const res = await fetch(`${BASE}/app/pantry`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body: body.toString(),
    redirect: "manual",
  });
  console.log(`  -> ${res.status} ${res.statusText}`);

  const updated = await db.pantryShelf.findUnique({ where: { id: shelf.id } });
  const passed = updated?.name === newName;

  console.log(`\nShelf name in DB: "${updated?.name}"`);
  console.log(passed ? "PASS: plain form POST updated the record with no JS involved." : "FAIL");

  await db.$disconnect();
  process.exit(passed ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
