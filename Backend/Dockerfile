# syntax=docker/dockerfile:1

# =============================================================================
# Muse Backend — Fastify API + worker (Node 20, TypeScript ESM, Prisma 7)
# =============================================================================

# ── Build stage ──────────────────────────────────────────────────────────────
# better-sqlite3 is a native addon: it needs python3 + a C/C++ toolchain to
# compile during `npm ci`. node:20-slim lacks these, so install build-essential.
FROM node:20-slim AS build

WORKDIR /app

# Toolchain for native module compilation (better-sqlite3).
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        python3 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source (prisma schema, src/, tsconfig, etc.).
COPY . .

# Generate the Prisma client, then compile TypeScript to dist/.
# (npm run build === `prisma generate && tsc`; we run generate explicitly first
# so the step is visible/cacheable and robust to script changes.)
RUN npx prisma generate
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Copy only what's needed to run. node_modules from the build stage already
# contains the compiled better-sqlite3 binary and the generated Prisma client,
# so no recompilation/toolchain is required at runtime.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
# prisma.config.ts supplies the datasource URL to the Prisma CLI; the entrypoint
# runs `prisma db push` at startup, so it must be present in the runtime image.
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# SQLite data directory (mount a volume here in production). The app creates it
# on startup if missing; declaring it keeps the path explicit.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 5000

# The entrypoint runs `prisma db push` to create/sync the schema (a fresh volume
# starts empty), then execs the command below. Worker overrides the command in
# docker-compose; the entrypoint applies to both.
ENTRYPOINT ["./docker-entrypoint.sh"]

# Default: start the API server.
CMD ["node", "dist/index.js"]

# -----------------------------------------------------------------------------
# Run the background worker from this same image by overriding the command:
#
#   docker run --rm muse-backend node dist/workers/runner.js
#
# or in docker-compose:
#
#   command: ["node", "dist/workers/runner.js"]
# -----------------------------------------------------------------------------
