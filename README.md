# Muse

Muse is a self-hosted music streaming, library, playlist, and recommendation application. It has a Next.js frontend, a Fastify backend, a PostgreSQL database, a background worker, and a bundled Python FastAPI service named `hifi-api` for Tidal-compatible catalogue and stream access.

The project is designed for local or self-managed deployment. Audio playback depends on the `hifi-api` service and valid Tidal-compatible authentication material. Personalised recommendations depend on Last.fm when `LASTFM_API_KEY` is configured.

## Table of Contents

- [Quick Start](#quick-start)
- [Project Overview](#project-overview)
- [Problem Statement](#problem-statement)
- [Project Goals](#project-goals)
- [Key Features](#key-features)
- [Supported Use Cases](#supported-use-cases)
- [System Architecture](#system-architecture)
- [Application Workflow](#application-workflow)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Local Installation](#local-installation)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Available Scripts and Commands](#available-scripts-and-commands)
- [API Documentation](#api-documentation)
- [Authentication and Authorisation](#authentication-and-authorisation)
- [Input Validation](#input-validation)
- [Error Handling](#error-handling)
- [Logging](#logging)
- [Testing](#testing)
- [Code Quality Checks](#code-quality-checks)
- [Build Process](#build-process)
- [Production Deployment](#production-deployment)
- [CI Process](#ci-process)
- [Security Considerations](#security-considerations)
- [Performance Considerations](#performance-considerations)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Repository Metrics](#repository-metrics)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)
- [Contribution Guidelines](#contribution-guidelines)
- [Coding Standards](#coding-standards)
- [Licence](#licence)
- [Support and Contact](#support-and-contact)

## Quick Start

These steps are for Windows PowerShell from the repository root, `D:\Downloads\Muse` or your own clone path.

1. Install project dependencies.

```powershell
.\setup.ps1
```

This installs root, backend, and frontend npm dependencies. It also creates `hifi-api\.venv`, installs Python dependencies, and creates `Backend\.env` if it does not exist. The expected result is a final `Setup complete.` message.

Common error: `python` or `npm` is not recognised. Install Python and Node.js, then reopen PowerShell.

2. Configure the backend.

Edit `Backend\.env` and set at least these values when needed:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/muse
LASTFM_API_KEY=your_lastfm_api_key_here
JWT_SECRET=replace-this-with-a-long-random-secret
TIDAL_API_BASE_URL=http://localhost:8000
```

The expected result is that the backend can connect to PostgreSQL and can call the local `hifi-api` service.

Common error: `P1001` or connection errors from Prisma. Start PostgreSQL and confirm that `DATABASE_URL` points to an existing database.

3. Authenticate `hifi-api` once.

```powershell
cd hifi-api
.\.venv\Scripts\python.exe tidal_auth\tidal_auth.py
cd ..
```

This creates or updates `hifi-api\token.json`. The expected result is that `hifi-api` can request Tidal-compatible metadata and streams.

Common error: `token.json missing`. Run the command above again from the `hifi-api` directory.

4. Start PostgreSQL.

The default backend connection is:

```text
postgresql://postgres:postgres@localhost:5432/muse
```

The repository does not start a local PostgreSQL service in `start.ps1`. Use an installed PostgreSQL server, or use Docker Compose as described later.

5. Run the application.

```powershell
.\start.ps1
```

This opens separate PowerShell windows for `hifi-api`, the backend API, the backend worker, and the frontend. The expected frontend URL is:

```text
http://localhost:3000
```

The expected backend API URL is:

```text
http://localhost:5000
```

The expected `hifi-api` URL is:

```text
http://localhost:8000
```

Common error: port already in use. Stop the process using the port or change `PORT`, `TIDAL_API_BASE_URL`, and `NEXT_PUBLIC_API_BASE_URL` consistently.

## Project Overview

Muse has four runtime processes and one database:

- `Frontend`: Next.js App Router application for the web user interface.
- `Backend`: Fastify REST API for authentication, user data, library, playlists, recommendations, settings, metrics, and hifi proxy routes.
- `Backend worker`: TypeScript worker that processes durable jobs from PostgreSQL.
- `hifi-api`: Python FastAPI service that talks to Tidal-compatible endpoints and returns catalogue, image, lyrics, and stream data.
- `PostgreSQL`: Main database used by Prisma for users, tracks, albums, artists, interactions, queues, playlists, jobs, caches, and homepage shelves.

The frontend calls the backend only. The backend calls `hifi-api`, Last.fm, MusicBrainz, and PostgreSQL.

## Problem Statement

Music applications usually separate playback, recommendations, user data, and catalogue metadata across closed services. Muse brings these concerns into a self-hosted application so that the code, data model, recommendation logic, and operational behaviour can be inspected and changed.

## Project Goals

- Provide a browser-based music application with accounts, library, playlists, search, discovery, settings, and playback.
- Store user history, settings, playlists, queues, recommendations, and caches in PostgreSQL.
- Use Last.fm and MusicBrainz metadata to improve discovery and enrichment.
- Proxy Tidal-compatible catalogue and stream access through a local Python service.
- Keep recommendation, homepage, enrichment, and queue work visible in source code.
- Support local development and Docker based deployment.

## Key Features

- Email and password signup and login.
- HS256 JWT session tokens.
- Per-user settings for quality, data saver, gapless playback, automix, and explicit content.
- Library actions for tracks, albums, artists, playlists, likes, and pins.
- Playlist creation, deletion, and track management.
- Search for tracks, artists, albums, and playlists through backend `/tidal` routes.
- Personalised homepage shelves for artist mixes, genre mixes, albums, and artists.
- Last.fm based recommendation engine using user seeds, similar tracks, similar artists, and chart fallbacks.
- PostgreSQL backed queue and session state.
- Background jobs for track enrichment, profile updates, and homepage building.
- PWA manifest and service worker registration.
- Player queue, shuffle, repeat, volume, lyrics, now playing, and keyboard shortcuts.
- API health, metrics, and Swagger UI.

## Supported Use Cases

- Run a local self-hosted music web application.
- Test recommendation logic against personal listening history.
- Build and inspect a music catalogue database.
- Develop a Next.js frontend against a Fastify API.
- Run background enrichment and homepage jobs with PostgreSQL durability.
- Explore backend endpoints through Swagger at `/docs`.

## System Architecture

```mermaid
flowchart TD
    Browser[Browser and PWA] --> Frontend[Next.js frontend on port 3000]
    Frontend --> Backend[Fastify backend on port 5000]
    Backend --> Postgres[(PostgreSQL database)]
    Backend --> Hifi[hifi-api on port 8000]
    Backend --> Lastfm[Last.fm API]
    Backend --> MusicBrainz[MusicBrainz API]
    Worker[Backend worker] --> Postgres
    Worker --> Lastfm
    Worker --> MusicBrainz
    Worker --> Hifi
```

### Runtime Flow

1. The browser loads the Next.js app.
2. The frontend stores a JWT in `localStorage` after login or signup.
3. The frontend sends `Authorization: Bearer <token>` to the backend.
4. The backend validates the token and resolves the user.
5. Catalogue, image, lyrics, and stream requests are proxied through `/tidal/*`.
6. The backend stores user interactions in PostgreSQL.
7. High signal events enqueue background jobs.
8. The worker claims jobs with leases and writes enriched data or homepage shelves back to PostgreSQL.

## Application Workflow

### Signup and Login

1. The user submits email, password, and display name on the frontend.
2. `POST /auth/signup` validates the body with Zod.
3. The backend hashes the password with Node.js `crypto.scrypt`.
4. The backend creates a user and returns a JWT.
5. The frontend stores the token and redirects into the authenticated app.

### Playback and Interaction

1. The user chooses a track.
2. The frontend calls `/tidal/tracks/:trackId/stream`.
3. The backend calls `hifi-api` and extracts a stream URL from the response.
4. The frontend plays the stream and reports interaction events.
5. The backend records plays, skips, likes, saves, follows, and repeats.
6. Strong events schedule profile and homepage rebuild jobs.

### Recommendation Flow

1. The backend gathers user seeds from interactions and saved library tracks.
2. Last.fm expands seed tracks and artists into candidates.
3. Candidates are resolved to playable Tidal-compatible tracks.
4. Recently played and over-exposed items are filtered.
5. Results are limited by surface and cached.
6. If Last.fm or Tidal resolution is sparse, the backend falls back to chart or database popularity.

## Technology Stack

### Backend API and Worker

| Technology  | Version              | Purpose                            | Location                                         |
| ----------- | -------------------- | ---------------------------------- | ------------------------------------------------ |
| Node.js     | 20 in CI and Docker  | Runtime for API and worker         | `.github/workflows/ci.yml`, `Backend/Dockerfile` |
| TypeScript  | 5.4.5                | Backend source language            | `Backend/package.json`                           |
| Fastify     | 4.27.0               | HTTP API server                    | `Backend/src/index.ts`                           |
| Prisma      | 7.8.0                | Database client and schema tooling | `Backend/prisma/schema.prisma`                   |
| PostgreSQL  | 16 in Docker Compose | Main database                      | `docker-compose.yml`                             |
| `pg`        | 8.13.1               | PostgreSQL driver                  | `Backend/package.json`                           |
| Zod         | 3.23.8               | Request body validation            | `Backend/src/api/*.ts`                           |
| Pino        | 9.2.0                | Backend logging                    | `Backend/src/logger.ts`, `Backend/src/index.ts`  |
| Vitest      | 4.1.8                | Backend test runner                | `Backend/vitest.config.ts`                       |
| Axios       | 1.7.2                | HTTP client for external calls     | `Backend/src/services/*`                         |
| `lru-cache` | 10.2.2               | In-memory TTL caches               | `Backend/src/cache/index.ts`                     |

### Frontend

| Technology            | Version | Purpose                           | Location                                            |
| --------------------- | ------- | --------------------------------- | --------------------------------------------------- |
| Next.js               | 16.1.6  | Frontend framework and App Router | `Frontend/package.json`                             |
| React                 | 19.2.3  | UI library                        | `Frontend/package.json`                             |
| Tailwind CSS          | 4.1.18  | Styling                           | `Frontend/package.json`, `Frontend/app/globals.css` |
| SWR                   | 2.4.1   | Frontend data fetching cache      | `Frontend/package.json`                             |
| Dash.js               | 4.7.4   | DASH playback support             | `Frontend/package.json`                             |
| React Compiler plugin | 1.0.0   | React compiler support            | `Frontend/package.json`                             |

### hifi-api

| Technology    | Version           | Purpose                            | Location                    |
| ------------- | ----------------- | ---------------------------------- | --------------------------- |
| Python        | 3.13.10 in Docker | Runtime for Tidal-compatible proxy | `hifi-api/Dockerfile`       |
| FastAPI       | 0.135.2           | Python API framework               | `hifi-api/requirements.txt` |
| Uvicorn       | 0.42.0            | ASGI server                        | `hifi-api/requirements.txt` |
| Hypercorn     | 0.18.0            | Alternative ASGI server dependency | `hifi-api/requirements.txt` |
| HTTPX         | 0.28.1            | HTTP client                        | `hifi-api/requirements.txt` |
| python-dotenv | 1.2.2             | `.env` loading                     | `hifi-api/requirements.txt` |

## Repository Structure

```text
Muse/
|-- .github/
|   `-- workflows/
|       `-- ci.yml
|-- Backend/
|   |-- prisma/
|   |   `-- schema.prisma
|   |-- src/
|   |   |-- api/
|   |   |-- cache/
|   |   |-- db/
|   |   |-- services/
|   |   |-- workers/
|   |   |-- auth.ts
|   |   |-- config.ts
|   |   |-- index.ts
|   |   |-- jwt.ts
|   |   |-- logger.ts
|   |   |-- metrics.ts
|   |   `-- password.ts
|   |-- .env.example
|   |-- Dockerfile
|   |-- docker-entrypoint.sh
|   |-- eslint.config.mjs
|   |-- package.json
|   |-- prisma.config.ts
|   |-- tsconfig.json
|   `-- vitest.config.ts
|-- Frontend/
|   |-- app/
|   |-- components/
|   |-- context/
|   |-- hooks/
|   |-- lib/
|   |-- public/
|   |-- types/
|   |-- utils/
|   |-- Dockerfile
|   |-- eslint.config.mjs
|   |-- next.config.mjs
|   |-- package.json
|   |-- postcss.config.js
|   `-- tsconfig.json
|-- hifi-api/
|   |-- tidal_auth/
|   |-- tests/
|   |-- .env.example
|   |-- Dockerfile
|   |-- docker-compose.yml
|   |-- main.py
|   |-- README.md
|   `-- requirements.txt
|-- .gitignore
|-- .prettierrc.json
|-- docker-compose.yml
|-- package.json
|-- setup.ps1
`-- start.ps1
```

Important paths:

- `Backend/src/api`: Fastify route handlers.
- `Backend/src/services`: recommendation, homepage, matching, Last.fm, MusicBrainz, hifi, and queue logic.
- `Backend/src/workers`: durable background worker and job handlers.
- `Backend/prisma/schema.prisma`: PostgreSQL schema with 19 models.
- `Frontend/app`: Next.js App Router pages.
- `Frontend/components`: reusable UI and playback components.
- `hifi-api/main.py`: Python FastAPI service consumed by the backend.
- `docker-compose.yml`: full stack compose file for PostgreSQL, hifi-api, backend API, worker, and frontend.

## Prerequisites

For local PowerShell development:

- Node.js and npm. The repository uses Node 20 in CI and Docker.
- Python. The Docker image uses Python 3.13.10. The local setup script uses the `python` command available on your machine.
- PostgreSQL reachable through `DATABASE_URL`.
- A Last.fm API key for recommendations and enrichment.
- Tidal-compatible authentication material for `hifi-api`.

For Docker deployment:

- Docker and Docker Compose.
- `Backend/.env`.
- `hifi-api/token.json` or a valid `hifi-api/.env` available before the `hifi-api` image is built.

Docker was not installed on the inspected machine, so Docker commands were verified from repository files and not executed locally.

## Local Installation

### PowerShell Setup Script

Run from the repository root:

```powershell
.\setup.ps1
```

The script performs:

- `npm install` in the root.
- `npm --prefix Backend install`.
- `npm --prefix Frontend install`.
- Python virtual environment creation under `hifi-api\.venv`.
- Python dependency installation from `hifi-api\requirements.txt`.
- Python dependency installation from `hifi-api\tidal_auth\requirements.txt`.
- Creation of `Backend\.env` with a minimal backend configuration if missing.

### Manual Installation

Run from the repository root:

```powershell
npm install
npm --prefix Backend install
npm --prefix Frontend install
```

Then install Python dependencies:

```powershell
cd hifi-api
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install -r tidal_auth\requirements.txt
cd ..
```

## Environment Configuration

### Backend Variables

These variables are read by `Backend/src/config.ts` and documented in `Backend/.env.example`.

| Variable                          | Required                          | Purpose                                | Expected format               | Safe example                                         | Default                              | Security notes                                                 |
| --------------------------------- | --------------------------------- | -------------------------------------- | ----------------------------- | ---------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `NODE_ENV`                        | Optional                          | Runtime mode                           | `development` or `production` | `development`                                        | `development`                        | Production disables dev identity fallback.                     |
| `PORT`                            | Optional                          | Backend API port                       | Number                        | `5000`                                               | `5000`                               | Must match frontend API base URL.                              |
| `API_BASE_URL`                    | Optional                          | Public backend URL used for image URLs | URL                           | `http://localhost:5000`                              | `http://localhost:5000`              | Do not point clients at a private internal URL.                |
| `LOG_LEVEL`                       | Optional                          | Pino log level                         | String                        | `info`                                               | `info`                               | Use `debug` carefully because DB query logging can be verbose. |
| `DEV_USER_ID`                     | Optional                          | Development fallback user id           | String                        | `dev-user-001`                                       | `dev-user-001`                       | Used only outside production.                                  |
| `JWT_SECRET`                      | Required for real deployment      | HS256 token signing secret             | Long random string            | `replace-with-long-random-value`                     | `muse-dev-insecure-secret-change-me` | The default is public and insecure.                            |
| `JWT_TTL_SEC`                     | Optional                          | JWT lifetime in seconds                | Number                        | `2592000`                                            | `2592000`                            | Lower it for shorter sessions.                                 |
| `DATABASE_URL`                    | Required                          | PostgreSQL connection                  | PostgreSQL URL                | `postgresql://postgres:postgres@localhost:5432/muse` | Same value                           | Contains credentials. Do not commit real values.               |
| `TIDAL_API_BASE_URL`              | Optional                          | Base URL for `hifi-api`                | URL                           | `http://localhost:8000`                              | `http://localhost:8000`              | In Compose this is `http://hifi-api:8000`.                     |
| `LASTFM_API_KEY`                  | Required for full recommendations | Last.fm API key                        | String                        | `your_lastfm_api_key_here`                           | Empty string                         | Do not commit a real key.                                      |
| `MUSICBRAINZ_APP`                 | Optional                          | MusicBrainz User-Agent app string      | String                        | `MusicRecEngine/1.0`                                 | `MusicRecEngine/1.0`                 | Should identify the app politely.                              |
| `QUEUE_SIZE`                      | Optional                          | Default recommendation queue length    | Number                        | `25`                                                 | `25`                                 | Used by queue manager.                                         |
| `HOME_REC_COUNT`                  | Optional                          | Home recommendation count              | Number                        | `20`                                                 | `20`                                 | Used by recommender surfaces.                                  |
| `MIX_TRACK_COUNT`                 | Optional                          | Tracks in recommendation mix surfaces  | Number                        | `30`                                                 | `30`                                 | Used by recommender surfaces.                                  |
| `RECENCY_DECAY_DAYS`              | Optional                          | Profile recency decay window           | Number                        | `30`                                                 | `30`                                 | Affects genre profile weighting.                               |
| `CACHE_PROFILE_TTL_MS`            | Optional                          | Profile cache TTL                      | Milliseconds                  | `300000`                                             | `300000`                             | In-memory only.                                                |
| `CACHE_REC_TTL_MS`                | Optional                          | Recommendation cache TTL               | Milliseconds                  | `120000`                                             | `120000`                             | Stale results may be served while rebuilding.                  |
| `WORKER_POLL_MS`                  | Optional                          | Worker polling interval                | Milliseconds                  | `500`                                                | `500`                                | Lower values increase DB polling.                              |
| `WORKER_CONCURRENCY`              | Optional                          | Worker parallel job limit              | Number                        | `4`                                                  | `4`                                  | Used by `p-limit`.                                             |
| `JOB_MAX_ATTEMPTS`                | Optional                          | Max job attempts                       | Number                        | `3`                                                  | `3`                                  | Failed jobs become terminal after this.                        |
| `JOB_RETRY_BASE_SEC`              | Optional                          | Job retry base backoff                 | Seconds                       | `60`                                                 | `60`                                 | Backoff is attempt count times this value.                     |
| `JOB_LEASE_SEC`                   | Optional                          | Job lease before reclaim               | Seconds                       | `300`                                                | `300`                                | Protects against stranded running jobs.                        |
| `JOB_CLEANUP_INTERVAL_MS`         | Optional                          | Maintenance cleanup interval           | Milliseconds                  | `3600000`                                            | `3600000`                            | Worker cleanup cadence.                                        |
| `LASTFM_CACHE_GRACE_DAYS`         | Optional                          | Last.fm stale cache retention          | Days                          | `30`                                                 | `30`                                 | Stale rows can be served on rate limits.                       |
| `SHELF_IMPRESSION_RETENTION_DAYS` | Optional                          | Shelf impression retention             | Days                          | `90`                                                 | `90`                                 | Used to suppress over-exposed items.                           |
| `QUEUE_LOW_WATER_MARK`            | Optional                          | Queue refill threshold                 | Number                        | `5`                                                  | `5`                                  | Queue refills when below this count.                           |
| `SESSION_TTL_MS`                  | Optional                          | Playback session queue TTL             | Milliseconds                  | `10800000`                                           | `10800000`                           | 3 hours by default.                                            |
| `PLAYED_IDS_HISTORY_CAP`          | Optional                          | Stored played ids per session          | Number                        | `200`                                                | `200`                                | Limits session payload size.                                   |
| `HIGH_SIGNAL_COMPLETION_RATIO`    | Optional                          | Completion ratio for profile update    | Decimal                       | `0.8`                                                | `0.8`                                | Used by playback queue update.                                 |
| `SEED_TRACK_CAP`                  | Optional                          | Max seed tracks                        | Number                        | `8`                                                  | `8`                                  | Used for Last.fm similar track expansion.                      |
| `SEED_ARTIST_CAP`                 | Optional                          | Max seed artists                       | Number                        | `4`                                                  | `4`                                  | Used for Last.fm similar artist expansion.                     |
| `SIMILAR_PER_TRACK`               | Optional                          | Similar tracks per seed                | Number                        | `30`                                                 | `30`                                 | Used by Last.fm calls.                                         |
| `MAX_TIDAL_LOOKUPS`               | Optional                          | Candidate Tidal resolution cap         | Number                        | `44`                                                 | `44`                                 | Limits external calls per recommendation request.              |
| `TIDAL_RESOLVE_BATCH`             | Optional                          | Tidal lookup batch size                | Number                        | `5`                                                  | `5`                                  | Controls concurrent resolution batches.                        |
| `PROFILE_MAX_GENRES`              | Optional                          | Max stored profile genres              | Number                        | `20`                                                 | `20`                                 | Used by profile builder.                                       |
| `PROFILE_INTERACTION_LIMIT`       | Optional                          | Interactions used to build profile     | Number                        | `5000`                                               | `5000`                               | Higher values increase profile query work.                     |
| `SECTION_ITEM_COUNT`              | Optional                          | Items per homepage section             | Number                        | `10`                                                 | `10`                                 | Used by homepage builder.                                      |
| `COLLECTION_TRACK_COUNT`          | Optional                          | Tracks per generated collection        | Number                        | `50`                                                 | `50`                                 | Used by system mixes and playlists.                            |
| `HOMEPAGE_FRESH_SEC`              | Optional                          | Homepage cache freshness               | Seconds                       | `21600`                                              | `21600`                              | 6 hours by default.                                            |
| `TRACK_POOL_SIZE`                 | Optional                          | Minimum homepage track pool            | Number                        | `180`                                                | `180`                                | Used by homepage builder.                                      |

### Frontend Variables

| Variable                   | Required           | Purpose                                                    | Expected format               | Safe example            | Default                 | Security notes                                 |
| -------------------------- | ------------------ | ---------------------------------------------------------- | ----------------------------- | ----------------------- | ----------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Optional           | Backend URL used by browser-side frontend calls            | URL                           | `http://localhost:5000` | `http://localhost:5000` | Public because it is bundled into client code. |
| `NODE_ENV`                 | Managed by Next.js | Controls production checks and service worker registration | `development` or `production` | `production`            | Set by runtime          | Do not use it for secrets.                     |

### hifi-api Variables

These are read by `hifi-api/main.py` and `hifi-api/tidal_auth/tidal_auth.py`.

| Variable                        | Required                        | Purpose                                       | Expected format | Safe example               | Default        | Security notes                                  |
| ------------------------------- | ------------------------------- | --------------------------------------------- | --------------- | -------------------------- | -------------- | ----------------------------------------------- |
| `CLIENT_ID`                     | Optional if `token.json` exists | Tidal-compatible client id                    | String          | Empty for token-file setup | Empty          | Treat real values as credentials.               |
| `CLIENT_SECRET`                 | Optional if `token.json` exists | Tidal-compatible client secret                | String          | Empty for token-file setup | Empty          | Secret. Do not commit.                          |
| `USER_ID`                       | Optional if `token.json` exists | Tidal-compatible user id                      | String          | Empty for token-file setup | Empty          | Do not commit personal ids.                     |
| `REFRESH_TOKEN`                 | Optional if `token.json` exists | Refresh token                                 | String          | Empty for token-file setup | Empty          | Secret. Do not commit.                          |
| `TOKEN_FILE`                    | Optional                        | Token file path                               | File path       | `token.json`               | `token.json`   | Keep token files out of git.                    |
| `COUNTRY_CODE`                  | Optional                        | Country code for upstream requests            | Two-letter code | `US`                       | `US`           | May affect catalogue availability.              |
| `USE_PROXIES`                   | Optional                        | Enable proxy support                          | Boolean string  | `False`                    | `False`        | Only use trusted proxies.                       |
| `ROTATE_PROXIES_ON_REFRESH`     | Optional                        | Rotate proxy during token refresh             | Boolean string  | `False`                    | `False`        | Only use trusted proxies.                       |
| `PROXIES_FILE`                  | Optional                        | Proxy list file                               | File path       | `proxies.txt`              | `proxies.txt`  | May contain proxy credentials.                  |
| `MAX_RETRIES`                   | Optional                        | Retry count                                   | Number          | `2`                        | `2`            | Higher values increase upstream retries.        |
| `FALLBACK_TO_DIRECT_CONNECTION` | Optional                        | Fall back to direct network when proxies fail | Boolean string  | `False`                    | `False`        | Can expose host IP if set to true.              |
| `USER_AGENT`                    | Optional                        | Upstream User-Agent value                     | String          | `okhttp/5.3.2`             | `okhttp/5.3.2` | Do not use personal data.                       |
| `DEV_MODE`                      | Optional                        | Verbose upstream logging                      | Boolean string  | `False`                    | `False`        | Can log headers and bodies. Avoid with secrets. |

## Database Setup

The database schema is defined in `Backend/prisma/schema.prisma`. It uses PostgreSQL and 19 Prisma models.

For local development, create or provide a PostgreSQL database that matches `DATABASE_URL`.

To push the Prisma schema after PostgreSQL is reachable:

```powershell
npm --prefix Backend run db:push
```

This command runs `prisma db push` from the backend package. It creates or synchronises the schema. It was not executed during README generation because it requires a running database and can modify schema state.

In Docker, `Backend/docker-entrypoint.sh` runs:

```sh
npx prisma db push
```

before starting the API or worker.

## Running the Application

### Full Local Stack With PowerShell Windows

Run from the repository root:

```powershell
.\start.ps1
```

This starts:

- `hifi-api` on `127.0.0.1:8000`, only if `hifi-api\.venv` and `hifi-api\token.json` exist.
- Backend API on port `5000`.
- Backend worker.
- Frontend on port `3000`.

### Root npm Development Script

Run from the repository root:

```powershell
npm run dev
```

This runs `Backend` schema push and then starts `hifi-api`, backend API, worker, and frontend through `concurrently`. This script uses a Windows virtual environment path for Python:

```text
hifi-api\.venv\Scripts\python.exe
```

### Core Development Without hifi-api and Worker

Run from the repository root:

```powershell
npm run dev:core
```

This starts only the backend API and frontend after running the backend schema push.

## Available Scripts and Commands

### Root Scripts

| Command               | Run from        | Purpose                                                              |
| --------------------- | --------------- | -------------------------------------------------------------------- |
| `npm run dev`         | Repository root | Push schema, then start hifi-api, backend API, worker, and frontend. |
| `npm run dev:core`    | Repository root | Push schema, then start backend API and frontend only.               |
| `npm run build`       | Repository root | Build backend and frontend.                                          |
| `npm test`            | Repository root | Run backend tests.                                                   |
| `npm run lint`        | Repository root | Run backend and frontend lint.                                       |
| `npm run typecheck`   | Repository root | Run backend type checking only.                                      |
| `npm run install:all` | Repository root | Install backend and frontend dependencies.                           |

### Backend Scripts

| Command                                | Run from        | Purpose                                                                      |
| -------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| `npm --prefix Backend run dev`         | Repository root | Start backend API with `tsx watch`.                                          |
| `npm --prefix Backend run predev`      | Repository root | Run `prisma db push`; npm also runs this automatically before backend `dev`. |
| `npm --prefix Backend run worker`      | Repository root | Start backend worker with `tsx watch`.                                       |
| `npm --prefix Backend run start`       | Repository root | Start compiled backend from `dist/index.js`.                                 |
| `npm --prefix Backend run build`       | Repository root | Generate Prisma client and compile TypeScript.                               |
| `npm --prefix Backend run db:push`     | Repository root | Push Prisma schema to PostgreSQL.                                            |
| `npm --prefix Backend run db:generate` | Repository root | Generate Prisma client.                                                      |
| `npm --prefix Backend run db:studio`   | Repository root | Open Prisma Studio.                                                          |
| `npm --prefix Backend run regen:mixes` | Repository root | Run system mix regeneration script.                                          |
| `npm --prefix Backend test`            | Repository root | Run Vitest once.                                                             |
| `npm --prefix Backend run test:watch`  | Repository root | Run Vitest in watch mode.                                                    |
| `npm --prefix Backend run lint`        | Repository root | Run ESLint on backend source.                                                |
| `npm --prefix Backend run typecheck`   | Repository root | Run `tsc --noEmit`.                                                          |

### Frontend Scripts

| Command                           | Run from        | Purpose                      |
| --------------------------------- | --------------- | ---------------------------- |
| `npm --prefix Frontend run dev`   | Repository root | Start Next.js dev server.    |
| `npm --prefix Frontend run build` | Repository root | Build the Next.js app.       |
| `npm --prefix Frontend run start` | Repository root | Serve the built Next.js app. |
| `npm --prefix Frontend run lint`  | Repository root | Run frontend ESLint.         |

## API Documentation

Swagger UI is registered at:

```text
http://localhost:5000/docs
```

The backend exposes 57 Fastify method routes. Routes use JSON unless they return image bytes.

### Common Headers

| Header                           | Required                              | Purpose                                                                         |
| -------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| `Content-Type: application/json` | Required for JSON bodies              | Parses request bodies.                                                          |
| `Authorization: Bearer <token>`  | Required for authenticated user flows | Identifies the logged-in user.                                                  |
| `x-user-id: <userId>`            | Development only                      | Used only when `NODE_ENV` is not `production` and no valid bearer token exists. |

### Auth Routes

| Method | Route          | Purpose             | Body or query                      | Main success response | Error status |
| ------ | -------------- | ------------------- | ---------------------------------- | --------------------- | ------------ |
| `POST` | `/auth/signup` | Create account      | `email`, `password`, `displayName` | `201`, token and user | `400`, `409` |
| `POST` | `/auth/login`  | Login               | `email`, `password`                | token and user        | `400`, `401` |
| `GET`  | `/auth/me`     | Return current user | Bearer token                       | `{ user }`            | `401`        |

Example signup:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5000/auth/signup -ContentType application/json -Body '{"email":"dev@example.com","password":"password123","displayName":"Dev User"}'
```

### User and Recommendation Routes

| Method | Route                            | Purpose                                                        | Body or query                                | Auth                        |
| ------ | -------------------------------- | -------------------------------------------------------------- | -------------------------------------------- | --------------------------- |
| `GET`  | `/users/:userId/profile`         | Get stored user profile                                        | Path `userId`                                | User must exist             |
| `POST` | `/users/:userId/profile/rebuild` | Rebuild profile inline                                         | Path `userId`                                | User must exist             |
| `GET`  | `/users/:userId/top-tracks`      | Get top tracks                                                 | Optional `limit`, max 50                     | Owner                       |
| `GET`  | `/users/:userId/top-artists`     | Get top artists                                                | Optional `limit`, max 50                     | Owner                       |
| `GET`  | `/users/:userId/recommendations` | Get recommendations                                            | `surface`, `seedTrackId`, `limit`            | User must exist             |
| `GET`  | `/users/:userId/radio/seeds`     | Pick radio seeds                                               | Path `userId`                                | User must exist             |
| `POST` | `/users/:userId/queue/init`      | Start a playback queue                                         | Query `sessionId`, optional `seedTrackId`    | User must exist             |
| `POST` | `/users/:userId/queue/update`    | Update queue after playback                                    | `sessionId`, `currentTrackId`, `playedRatio` | User must exist             |
| `GET`  | `/users/:userId/queue`           | Read queue                                                     | Query `sessionId`                            | Session id required         |
| `GET`  | `/users/:userId/homepage`        | Get personalised homepage                                      | Path `userId`                                | User id path                |
| `GET`  | `/users/:userId/homepage/debug`  | Debug homepage shelf counts                                    | Path `userId`                                | User id path                |
| `POST` | `/users/:userId/interactions`    | Record play, skip, like, save, follow, playlist add, or repeat | Interaction body                             | Auto-creates user if absent |

### Library and Playlist Routes

| Method   | Route                            | Purpose                     | Body or query                   | Auth                    |
| -------- | -------------------------------- | --------------------------- | ------------------------------- | ----------------------- |
| `GET`    | `/library`                       | List current user's library | None                            | Current user            |
| `POST`   | `/library`                       | Add library item            | `itemType`, `itemId`            | Current user            |
| `DELETE` | `/library`                       | Remove library item         | `itemType`, `itemId`            | Current user            |
| `GET`    | `/playlists`                     | List playlists              | None                            | Current user            |
| `POST`   | `/playlists`                     | Create playlist             | `title`, optional `description` | Current user            |
| `DELETE` | `/playlists/:id`                 | Delete playlist             | Path `id`                       | Current user            |
| `GET`    | `/playlists/:id/tracks`          | List playlist tracks        | Path `id`                       | No owner check in route |
| `POST`   | `/playlists/:id/tracks`          | Add track to playlist       | `trackId`                       | Playlist owner          |
| `DELETE` | `/playlists/:id/tracks/:trackId` | Remove track from playlist  | Path `id`, `trackId`            | Playlist owner          |

### Browse, Action, and Settings Routes

| Method | Route                           | Purpose                                                        | Body or query                                         | Auth                                   |
| ------ | ------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| `GET`  | `/browse/search-sections`       | Build browse sections                                          | None                                                  | Current identity used for context only |
| `GET`  | `/browse/search-sections/debug` | Verify browse section counts                                   | None                                                  | Current identity used for context only |
| `GET`  | `/browse/recent-searches`       | Read last 10 searches                                          | None                                                  | Current user                           |
| `POST` | `/browse/searches`              | Save search history                                            | `query`, `itemType`, `itemId`, `imageUrl`, `metadata` | Current user                           |
| `GET`  | `/browse/home`                  | Get homepage shelves                                           | None                                                  | Current user                           |
| `POST` | `/actions/:action`              | Toggle like, library, pin, or return placeholder action result | `userId`, `type`, `id`                                | Owner                                  |
| `GET`  | `/context-menu/:type/:id`       | Get item library and pin state                                 | Query `userId`                                        | Owner                                  |
| `GET`  | `/settings`                     | Read settings                                                  | None                                                  | Authenticated user                     |
| `PUT`  | `/settings`                     | Update settings                                                | Settings patch body                                   | Authenticated user                     |

### Track and Metadata Routes

| Method | Route                          | Purpose                                                       | Body or query     | Error status |
| ------ | ------------------------------ | ------------------------------------------------------------- | ----------------- | ------------ |
| `POST` | `/tracks/ingest`               | Fetch and persist tracks from hifi-api                        | `trackIds` array  | `400`        |
| `GET`  | `/tracks/:trackId`             | Read raw stored track and features                            | Path `trackId`    | `404`        |
| `POST` | `/tracks/:trackId/enrich`      | Queue enrichment for one track                                | Path `trackId`    | `404`        |
| `GET`  | `/lastfm/artist/:artistName`   | Fetch Last.fm artist info and Tidal-validated similar artists | Path `artistName` | `404`, `502` |
| `GET`  | `/lastfm/tag/:tagName`         | Fetch Last.fm tag info                                        | Path `tagName`    | `404`, `502` |
| `GET`  | `/lastfm/tag/:tagName/similar` | Fetch similar Last.fm tags                                    | Optional `limit`  | `502`        |

### Tidal Proxy Routes

| Method | Route                                    | Purpose                                   | Body or query                                    | Error status                     |
| ------ | ---------------------------------------- | ----------------------------------------- | ------------------------------------------------ | -------------------------------- |
| `GET`  | `/tidal/genres`                          | Return genre tags                         | Optional `limit`, max 30                         | Returns empty list on failure    |
| `GET`  | `/tidal/genre-albums`                    | Return albums for tag or global chart     | Optional `tag`, `limit`, max 50                  | Returns empty list on failure    |
| `GET`  | `/tidal/images/:pictureId`               | Proxy image bytes and extract colour      | `size`, `type`                                   | `404`                            |
| `GET`  | `/tidal/images/:pictureId/color`         | Return extracted colour                   | `mode`, `size`, `type`                           | Returns `null` colour on failure |
| `GET`  | `/tidal/search`                          | Search one type                           | Required `q`, optional `type`, `limit`, `offset` | `400`, `502`                     |
| `GET`  | `/tidal/search/all`                      | Search tracks, artists, albums, playlists | Required `q`, optional `limit`                   | `400`, `502`                     |
| `GET`  | `/tidal/tracks/:trackId`                 | Fetch track metadata                      | Path `trackId`                                   | `404`, `502`                     |
| `GET`  | `/tidal/tracks/:trackId/stream`          | Fetch stream manifest and stream URL      | Optional `quality`                               | `502`                            |
| `GET`  | `/tidal/tracks/:trackId/recommendations` | Fetch Tidal-native related tracks         | Path `trackId`                                   | `502`                            |
| `GET`  | `/tidal/albums/:albumId`                 | Fetch album and tracks                    | `limit`, `offset`                                | `502`                            |
| `GET`  | `/tidal/artists/:artistId`               | Fetch artist, albums, and top tracks      | Path `artistId`                                  | `502`                            |
| `GET`  | `/tidal/artists/:artistId/similar`       | Fetch similar artists                     | Path `artistId`                                  | `502`                            |
| `GET`  | `/tidal/albums/:albumId/similar`         | Fetch similar albums                      | Path `albumId`                                   | `502`                            |
| `GET`  | `/tidal/playlists/:playlistId`           | Fetch local, system, or external playlist | `limit`, `offset`                                | `502`                            |
| `GET`  | `/tidal/mixes/:mixId`                    | Fetch local or external mix               | Path `mixId`                                     | `502`                            |
| `GET`  | `/tidal/health`                          | Check hifi-api reachability               | None                                             | `503`                            |

### Infrastructure Routes

| Method | Route      | Purpose                                     | Response                       |
| ------ | ---------- | ------------------------------------------- | ------------------------------ |
| `GET`  | `/health`  | Backend liveness                            | `{ "status": "ok" }`           |
| `GET`  | `/metrics` | In-process counters and latency percentiles | JSON object of numeric metrics |
| `GET`  | `/docs`    | Swagger UI                                  | HTML UI                        |

### Internal hifi-api Routes

The Python service is normally consumed through backend `/tidal/*` routes. Its direct routes are defined in `hifi-api/main.py`:

```text
GET /
GET /info/
GET /track/
GET /trackManifests/
GET /widevine
POST /widevine
GET /recommendations/
GET /search/
GET /album/
GET /mix/
GET /playlist/
GET /artist/similar/
GET /album/similar/
GET /artist/
GET /cover/
GET /lyrics/
GET /topvideos/
GET /video/
```

## Authentication and Authorisation

Authentication is implemented in backend source, not through an external auth service.

- Passwords are hashed with `crypto.scrypt`.
- Stored password format is `salt:hash` in hex.
- JWTs are signed with HS256 using `JWT_SECRET`.
- JWT payload includes `sub`, `iat`, and `exp`.
- The frontend stores the token under `muse-token` in `localStorage`.
- The frontend attaches `Authorization: Bearer <token>` to backend requests.
- In non-production mode only, the backend falls back to `x-user-id` or `DEV_USER_ID` when no valid token exists.
- In production mode, routes that require identity reject missing or mismatched identities.

Owner checks are implemented with `ensureSelf` on routes that operate on another user's resource id.

## Input Validation

The backend uses Zod for these request bodies:

- `POST /auth/signup`
- `POST /auth/login`
- `POST /users/:userId/interactions`
- `POST /library`
- `DELETE /library`
- `POST /playlists`
- `POST /playlists/:id/tracks`
- `PUT /settings`
- `POST /actions/:action`
- `POST /browse/searches`
- `POST /users/:userId/queue/update`

Other route parameters are parsed directly in route handlers. Numeric limits are capped in selected routes, for example top tracks and top artists max at 50.

## Error Handling

The backend has a global Fastify error handler:

- Logs method, URL, request id, and error.
- Returns `500` with `{ "error": "Internal server error", "requestId": "<id>" }` for unhandled errors.
- Returns `404` with `{ "error": "Not found", "requestId": "<id>" }` for unknown routes.

Route handlers also return specific statuses such as:

- `400` for invalid input.
- `401` for invalid credentials or missing authentication.
- `403` for ownership failures.
- `404` for missing users, tracks, artists, or playlists.
- `409` for duplicate signup email.
- `422` when profile rebuild has insufficient interaction data.
- `502` when upstream Last.fm or hifi-api calls fail.
- `503` when `hifi-api` health check fails.

## Logging

- Backend logging uses Pino.
- Development mode uses `pino-pretty`.
- Log level is controlled by `LOG_LEVEL`.
- Per-route latency is collected through Fastify hooks and exposed by `/metrics`.
- Worker logs job start, job failure, cleanup issues, and enqueue failures.
- Frontend logging is disabled in production by `Frontend/lib/logger.ts`.

## Testing

Backend tests use Vitest and are configured in `Backend/vitest.config.ts`.

Run backend tests:

```powershell
npm --prefix Backend test
```

Run tests in watch mode:

```powershell
npm --prefix Backend run test:watch
```

Verified backend test coverage in the repository:

- `Backend/src/auth.test.ts`
- `Backend/src/password.test.ts`
- `Backend/src/metrics.test.ts`
- `Backend/src/db/helpers.test.ts`
- `Backend/src/services/artistFilters.test.ts`
- `Backend/src/services/matching.test.ts`
- `Backend/src/services/popularityService.test.ts`

There are 29 Vitest `it(...)` test cases in these files.

The `hifi-api/tests` directory contains script-style HTTP tests and a load script. They require a running `hifi-api` service and valid upstream credentials. They are not wired into a root package script.

Dependencies were not installed during README generation, so tests were documented from package scripts and source files rather than executed.

## Code Quality Checks

Run lint for backend and frontend:

```powershell
npm run lint
```

Run backend type checking:

```powershell
npm run typecheck
```

Run frontend type checking manually, as CI does:

```powershell
cd Frontend
npx tsc --noEmit
cd ..
```

Formatting configuration is in `.prettierrc.json`:

```json
{
	"useTabs": true,
	"tabWidth": 2
}
```

## Build Process

Build both backend and frontend:

```powershell
npm run build
```

This runs:

- `npm --prefix Backend run build`
- `npm --prefix Frontend run build`

Backend build:

```powershell
npm --prefix Backend run build
```

This runs Prisma generate and TypeScript compilation.

Frontend build:

```powershell
npm --prefix Frontend run build
```

This creates the Next.js production build.

## Production Deployment

### Docker Compose

The root `docker-compose.yml` defines:

- `postgres` on host port `5432`.
- `hifi-api` on host port `8000`.
- `backend-api` on host port `5000`.
- `backend-worker` with no host port.
- `frontend` on host port `3000`.

Prepare backend environment:

```powershell
copy Backend\.env.example Backend\.env
```

Then edit `Backend\.env` and set real values for `JWT_SECRET`, `LASTFM_API_KEY`, and database related overrides if needed.

Prepare hifi authentication before building:

```powershell
cd hifi-api
.\.venv\Scripts\python.exe tidal_auth\tidal_auth.py
cd ..
```

If `hifi-api\.venv` does not exist, run `.\setup.ps1` first, or provide `hifi-api\.env` with valid `CLIENT_ID`, `CLIENT_SECRET`, `USER_ID`, and `REFRESH_TOKEN` values before building the image.

Then run:

```powershell
docker compose up --build
```

This command was not executed during README generation because Docker was not installed on the inspected machine.

### Manual Production Processes

Use separate terminals or a process manager.

Build backend from the `Backend` directory:

```powershell
cd Backend
npm run build
```

Start backend API from the `Backend` directory:

```powershell
node dist/index.js
```

Start backend worker from the `Backend` directory in a separate terminal:

```powershell
node dist/workers/runner.js
```

Start hifi-api from the `hifi-api` directory in a separate terminal:

```powershell
cd hifi-api
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Build and start frontend from the `Frontend` directory in a separate terminal:

```powershell
cd Frontend
npm run build
npm start
```

For production, put the frontend and backend behind HTTPS. Do not expose `hifi-api` publicly unless you understand the credential and upstream account risk.

## CI Process

GitHub Actions workflow: `.github/workflows/ci.yml`.

Triggers:

- Push to `main`.
- Pull request to `main`.

Backend CI:

- Checkout.
- Setup Node 20.
- `npm ci`.
- `npx prisma generate`.
- `npm run typecheck`.
- `npm run lint --if-present`.
- `npm test --if-present`.

Frontend CI:

- Checkout.
- Setup Node 20.
- `npm ci`.
- `npm run lint --if-present`.
- `npx tsc --noEmit`.
- `npm run build` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000`.

## Security Considerations

- Replace the default `JWT_SECRET` in any real deployment.
- Do not commit `.env`, `.env.local`, `token.json`, refresh tokens, proxy credentials, or database credentials.
- The frontend stores tokens in `localStorage`; treat XSS prevention as important.
- `@fastify/cors` is configured with `origin: true`, so review CORS policy before public deployment.
- Docker Compose uses default PostgreSQL credentials for local convenience. Change them outside development.
- `hifi-api` can expose upstream credentials and account behaviour. Keep it private.
- `FALLBACK_TO_DIRECT_CONNECTION=True` in `hifi-api` can expose the host IP when proxies fail.
- `DEV_MODE=True` in `hifi-api` can log sensitive upstream request data.
- Production mode removes the unauthenticated development fallback user.

## Performance Considerations

Verified from source:

- Profile cache: max 10,000 entries, default TTL 5 minutes.
- Recommendation cache: max 50,000 entries, default TTL 2 minutes, stale allowed.
- Session queue cache: max 100,000 entries, default TTL 3 hours.
- Metrics timing reservoir: max 1,000 samples per metric.
- Worker concurrency default: 4.
- Worker poll interval default: 500 ms.
- Job lease default: 300 seconds.
- Job max attempts default: 3.
- Queue size default: 25.
- Queue low water mark default: 5.
- Homepage cache freshness default: 6 hours.
- Shelf impression retention default: 90 days.
- Last.fm stale cache cleanup grace default: 30 days.
- Tidal resolution batch default: 5.
- Tidal lookup cap default: 44 per recommendation request.

Metrics such as bundle size, build time, runtime memory, and test coverage percentage are not measured in the current repository.

## Monitoring and Maintenance

Use these endpoints:

```text
GET /health
GET /metrics
GET /tidal/health
```

Use these maintenance commands:

```powershell
npm --prefix Backend run db:studio
npm --prefix Backend run regen:mixes
```

The worker also performs periodic cleanup:

- Expired Last.fm cache rows past grace period.
- Old shelf impressions past retention period.

## Repository Metrics

| Metric                                               | Verified value                          | Source or command                                                       | Notes                                               |
| ---------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| Repository files excluding `.git` and `node_modules` | 281                                     | `rg --files -uu -g '!**/node_modules/**' -g '!**/.git/**'`              | Includes source, configs, docs, and SVG assets.     |
| Backend Fastify method routes                        | 57                                      | Route extraction from `Backend/src/api/*.ts` and `Backend/src/index.ts` | Includes `/health` and `/metrics`.                  |
| hifi-api method route entries                        | 18                                      | Decorator extraction from `hifi-api/main.py`                            | `GET` and `POST /widevine` counted separately.      |
| Prisma models                                        | 19                                      | `Backend/prisma/schema.prisma`                                          | Main PostgreSQL schema.                             |
| Frontend App Router pages                            | 12                                      | `rg --files Frontend/app -g 'page.tsx'`                                 | Includes dynamic album, artist, and playlist pages. |
| Frontend TSX components                              | 43                                      | `rg --files Frontend/components -g '*.tsx'`                             | Includes UI primitives.                             |
| Backend test files                                   | 7                                       | `rg --files Backend -g '*.test.ts'`                                     | Vitest files.                                       |
| Backend Vitest test cases                            | 29                                      | `rg -n "it\\(" Backend/src -g "*.test.ts"`                              | Counted `it(...)` calls.                            |
| hifi-api test scripts                                | 2                                       | `rg --files hifi-api/tests`                                             | Script-style tests, not root CI tests.              |
| Root npm scripts                                     | 7                                       | `package.json`                                                          | Root orchestration scripts.                         |
| Backend npm scripts                                  | 13                                      | `Backend/package.json`                                                  | API, worker, DB, test, lint, typecheck.             |
| Frontend npm scripts                                 | 4                                       | `Frontend/package.json`                                                 | Next dev, build, start, lint.                       |
| Backend env variables                                | 40                                      | `Backend/.env.example` and `Backend/src/config.ts`                      | Includes `DATABASE_URL`.                            |
| hifi-api env variables read by code                  | 13                                      | `hifi-api/main.py`, `hifi-api/tidal_auth/tidal_auth.py`                 | Includes variables not shown in `.env.example`.     |
| Default frontend port                                | 3000                                    | `Frontend/Dockerfile`, `start.ps1`, `package.json`                      | Next.js default.                                    |
| Default backend port                                 | 5000                                    | `Backend/src/config.ts`, `docker-compose.yml`                           | Configurable by `PORT`.                             |
| Default hifi-api port                                | 8000                                    | `hifi-api/Dockerfile`, `start.ps1`, `docker-compose.yml`                | Uvicorn default in repo scripts.                    |
| Test coverage percentage                             | Not measured in the current repository. | No coverage script found                                                | Vitest coverage is not configured.                  |
| Bundle size                                          | Not measured in the current repository. | No bundle analysis script found                                         | Next build may report output when run.              |
| Build time                                           | Not measured in the current repository. | Build commands not executed                                             | Requires installed dependencies.                    |

## Troubleshooting

| Problem                                  | Likely cause                                             | Diagnostic command                                        | Resolution                                                          |
| ---------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| `python` is not recognised               | Python is not installed or not on `PATH`                 | `python --version`                                        | Install Python and reopen PowerShell.                               |
| `npm` is not recognised                  | Node.js is not installed or not on `PATH`                | `npm --version`                                           | Install Node.js and reopen PowerShell.                              |
| Prisma cannot connect                    | PostgreSQL is not running or `DATABASE_URL` is wrong     | `npm --prefix Backend run db:push`                        | Start PostgreSQL and fix `Backend/.env`.                            |
| Frontend cannot call backend             | Backend is not running or API base URL is wrong          | Open `http://localhost:5000/health`                       | Start backend and set `NEXT_PUBLIC_API_BASE_URL`.                   |
| `hifi-api` does not start in `start.ps1` | `.venv` or `token.json` is missing                       | `Test-Path hifi-api\.venv; Test-Path hifi-api\token.json` | Run `.\setup.ps1` and then hifi authentication.                     |
| Playback stream fails                    | `hifi-api` cannot fetch stream info                      | Open `http://localhost:5000/tidal/health`                 | Start `hifi-api` and refresh token credentials.                     |
| Recommendations are empty                | Missing Last.fm key or empty catalogue                   | Check backend logs and `LASTFM_API_KEY`                   | Set `LASTFM_API_KEY`, play or ingest tracks, and run worker.        |
| Login fails                              | Invalid password, duplicate email, or changed JWT secret | Check response status from `/auth/login`                  | Use the correct password. Keep `JWT_SECRET` stable across restarts. |
| Docker command is missing                | Docker is not installed                                  | `docker --version`                                        | Install Docker Desktop or use local PowerShell commands.            |
| Docker backend exits during startup      | `Backend/.env` missing or database schema push failed    | `docker compose logs backend-api`                         | Create `Backend/.env` and confirm database service health.          |

## Known Limitations

- Audio streaming depends on `hifi-api` and valid Tidal-compatible authentication.
- Personalised recommendations degrade when `LASTFM_API_KEY` is missing.
- The project does not include a native mobile app.
- PostgreSQL must be available for normal backend operation.
- Root development scripts are Windows PowerShell oriented.
- The frontend stores auth tokens in `localStorage`.
- The root project has no root `LICENSE` file.
- Test coverage percentage is not configured.
- Docker was not available on the inspected machine, so compose commands were not executed during README validation.

## Contribution Guidelines

1. Create a focused branch.
2. Keep changes scoped to the relevant backend, frontend, or hifi-api area.
3. Update this README when setup, environment variables, routes, or commands change.
4. Run the relevant checks before opening a pull request:

```powershell
npm run lint
npm run typecheck
npm test
```

5. For frontend changes, also run:

```powershell
cd Frontend
npx tsc --noEmit
npm run build
cd ..
```

## Coding Standards

- TypeScript strict mode is enabled in backend and frontend configs.
- Backend uses ESM modules.
- Backend raw SQL boundaries intentionally allow `any` in ESLint config.
- Formatting uses tabs with width 2.
- Do not commit generated build output, dependency directories, `.env` files, virtual environments, or token files.
- Prefer route-level validation with Zod for new JSON inputs.
- Keep secrets outside source code.

## Licence

No root project licence file is present in the repository.

The bundled `hifi-api` directory contains its own `LICENSE` file.

## Support and Contact

No support email, issue template for the root project, or maintainer contact is defined in the root repository. Use the repository issue tracker or project owner channel if one exists in your hosting environment.
