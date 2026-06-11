# syntax=docker/dockerfile:1

# =============================================================================
# Muse Frontend — Next.js 16 (React 19)
# =============================================================================

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-slim AS build

WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so the
# API base URL must be available here (not just at runtime). Override with:
#   docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com .
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Install dependencies first for layer caching. A package-lock.json is present,
# so prefer the reproducible `npm ci`; fall back to `npm install` if absent.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source and build.
COPY . .
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Re-declare so the value is also available at runtime (e.g. for SSR fetches).
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Copy the built app and its dependencies. (Using the default Next build output;
# `next start` serves .next/. No standalone output is configured.)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

# `next start` binds to 0.0.0.0:3000 by default inside the container.
CMD ["npm", "start"]
