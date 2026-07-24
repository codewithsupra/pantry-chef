# PantryChef

Track what's in your kitchen, see which of your saved recipes you can actually cook right now, and let an agent handle the busywork.

**Live:** https://pantry-chef-7s80.onrender.com

## What it does

- **Pantry tracking** — shelves and items with inline editing and instant search. Every action (rename, delete, add) is a real HTML form under a React Router `useFetcher`, so it degrades to working plain `<form>` submissions with JavaScript off, not just an optimistic-UI demo.
- **Recipe readiness matching** — the Discover page ranks your saved recipes by how much of each is already in your pantry. A baseline string-match ranking renders instantly, then a second pass through a free-tier LLM refines it with semantic matches and real ingredient substitutions (e.g. milk + lemon juice for buttermilk), streamed in without blocking the first paint.
- **Chef, a tool-calling agent** — ask it to plan a meal, add ingredients to your pantry, or draft a recipe from what you have. It calls real tools against your Postgres data and streams each step (plan → tool call → result) to the UI as it happens, not just a final answer.

## Stack

React Router v7 (SSR, loaders/actions, file-based routes) · Prisma + PostgreSQL (Neon) · Tailwind · magic-link auth (Resend) · OpenRouter, with a fallback chain across three free-tier models (nemotron → llama-3.3 → gemma) since free endpoints fail or stall often enough that no single one can be trusted alone.

## Local development

```bash
npm install
docker compose up -d          # local Postgres
npx prisma migrate deploy
npx prisma db seed            # optional: sample shelves and recipes
npm run dev
```

Copy `.env.example`-style values into `.env` (see `prisma.config.ts` for what's required: `DATABASE_URL`, `AUTH_COOKIE_SECRET`, `MAGIC_LINK_KEY`, `ORIGIN`, `RESEND_API_KEY`, `OPENROUTER_API_KEY`). In dev, `login` also prints the magic link straight to the server console, so signing in doesn't require a working email account.

## Deployment

Deployed on Render from the included `Dockerfile`. One thing worth knowing if you fork this: `prisma.config.ts` requires `DATABASE_URL` to resolve at all, even for `prisma generate`, which never opens a connection — but Render only injects real env vars at container *runtime*, not during `docker build`. Each build stage sets a placeholder `DATABASE_URL` for that reason; the real value from Render overrides it once the container starts, and `prisma migrate deploy` runs before the server does.
