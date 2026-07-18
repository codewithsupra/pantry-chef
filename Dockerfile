# prisma.config.ts requires DATABASE_URL to be set to resolve at all, even
# for `prisma generate` / `react-router build`, which never open a
# connection. Render only injects real env vars at container runtime, not
# during `docker build`, so every build stage gets a placeholder here — the
# real DATABASE_URL passed at container start overrides it.
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

FROM node:24-alpine AS development-dependencies-env
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
COPY . /app
WORKDIR /app
RUN npm ci
RUN npx prisma generate

FROM node:24-alpine AS production-dependencies-env
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
COPY ./package.json package-lock.json /app/
COPY ./prisma /app/prisma
WORKDIR /app
RUN npm ci --omit=dev
RUN npx prisma generate

FROM node:24-alpine AS build-env
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:24-alpine
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY ./prisma /app/prisma
COPY ./prisma.config.ts /app/
WORKDIR /app
# Real DATABASE_URL is injected by Render at container start, overriding the
# build-time placeholder. Apply pending migrations before serving traffic.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
