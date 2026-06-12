# Muse

A self-hosted music streaming and discovery platform that combines Last.fm-powered recommendations with high-fidelity (lossless and Hi-Res) audio streaming.

---

## Audience Navigation Guide

**For Recruiters**: Jump to [Overview](#overview), [Tech Stack](#tech-stack), and [System Architecture](#system-architecture) to understand the engineering scope and technical decisions.

**For Developers**: See [Developer Guide](#developer-guide), [Core Workflows](#core-workflows), and [Project Structure](#project-structure) for implementation details.

**For End Users**: Start with [How to Use](#how-to-use) and [Installation Guide](#installation-guide) to get the application running.

**For Contributors**: Read [Contribution Guide](#contribution-guide) and [Known Limitations](#known-limitations) before submitting changes.

---

## Overview

Muse is a full-stack music streaming application designed for personal use. It provides an interface similar to commercial streaming services, but runs entirely on your own computer or server.

### For Non-Technical Readers

Muse lets you browse, search, and play music through a web browser. It learns your taste over time and suggests songs you may enjoy. You can sign up for an account, like songs, build your own playlists, save albums and artists to your library, and play music with a full player that supports a queue, radio, gapless playback, and crossfade. The interface includes a personalised homepage, artist pages, album pages, a search page, a discover page, and a player bar that stays at the bottom of the screen. On a phone, the layout changes to a mobile style with a bottom navigation bar, and the app can be installed to your home screen like a normal app.

### For Technical Readers

The system is built from three running processes plus a shared database:

1. **API Server (Node.js + TypeScript)**: A Fastify REST API that handles authentication, user interactions, library and playlist management, recommendation generation, search, and proxying of the music service. SQLite (through Prisma 7 with the better-sqlite3 adapter, in WAL mode) is the primary datastore. The same SQLite database also holds a durable, leased job queue.

2. **Worker (Node.js + TypeScript)**: A separate process that polls the SQLite job queue and runs background jobs for track enrichment, user profile rebuilding, and homepage shelf building.

3. **Frontend (Next.js + React)**: A server-rendered React application using the App Router. Dash.js handles MPEG-DASH adaptive streaming, the Web Audio API handles loudness normalisation and crossfade, and TailwindCSS provides the styling. The frontend is also a Progressive Web App (PWA) with a service worker and an installable manifest.

4. **hifi-api (Python + FastAPI)**: A vendored Python service that proxies the Tidal music catalogue and lossless streaming. It provides metadata, search, cover art, lyrics, and MPEG-DASH stream manifests. The Node.js API talks to this service over HTTP.

The recommendation engine is powered by **Last.fm**. Personalised suggestions are generated from the user's listening seeds (recent plays, likes, and saved library tracks) through Last.fm's content-similarity endpoints (`track.getSimilar` and `artist.getSimilar` followed by `artist.getTopTracks`). Candidate tracks are mapped to playable Tidal tracks, de-duplicated, capped per artist for diversity, and ranked by Last.fm similarity and popularity. New users, who have no listening history, fall back to Last.fm charts.

---

## Problem Statement

Commercial streaming services lock users into closed ecosystems with limited control over recommendations and no access to their own listening data. Self-hosted alternatives often lack a polished interface or intelligent discovery features.

Muse addresses these gaps by providing:

- Complete data ownership through local SQLite storage
- Transparent recommendation logic that can be inspected and modified
- A responsive, modern interface comparable to commercial offerings, on both desktop and mobile
- Integration with existing music metadata and streaming services (Tidal through the hifi-api service, Last.fm, and MusicBrainz)
- No subscription fees and no vendor lock-in

---

## Key Features

### User-Facing Features

- **User Accounts**: Sign up and log in with an email address and password (minimum 8 characters). Sessions are managed with JSON Web Tokens (JWT) that last 30 days by default. Each account has its own library, playlists, history, and recommendations.
- **Personalised Homepage**: Dynamic shelves built from your listening history, including "Made For You" mixes, favourite artist recommendations, daily mixes, and discovery sections.
- **High-Fidelity Audio Streaming**: MPEG-DASH adaptive streaming with seven selectable quality tiers: Automatic, Low (24 kbps), Normal (96 kbps), High (160 kbps), Very High (320 kbps), Lossless (24-bit / 48 kHz), and Hi-Res Lossless (24-bit / 192 kHz).
- **Full Player**: A persistent player bar with play and pause, next and previous, seek, volume, shuffle, and repeat (off, all, one). A full-screen "Now Playing" view shows the queue and lyrics.
- **Gapless Playback and Crossfade**: Tracks are prefetched and faded using the Web Audio API for smooth transitions, with an automix option.
- **Volume Normalisation**: An optional loudness normalisation step (using a Web Audio compressor) keeps playback levels consistent across tracks.
- **Smart Queue and Radio**: The playback queue holds 25 tracks by default and refills itself whenever it falls below 5 remaining, and radio mode generates continuous playback from a seed track using similarity-based selection.
- **Library Management**: Like tracks, save albums and artists, create and manage playlists, and pin favourites to the sidebar.
- **Search with History**: Live search across tracks, albums, artists, and playlists, debounced at 350 milliseconds with in-flight request cancellation, and a record of your recent searches (the last 10).
- **Discover Page**: Browse by genre (sourced from Last.fm tags) and explore a global chart.
- **Artist and Album Pages**: Artist pages show a biography, listener count, similar artists, and tabs for the artist's most played and popular tracks, albums, and singles. Album pages show the full tracklist.
- **Context Menus**: Right-click (or long-press) actions for tracks, albums, and artists, including add to playlist, add to queue, like, save, pin, share, and go to artist.
- **Settings**: Control streaming and download quality, data saver, gapless playback, automix, crossfade, volume normalisation, and explicit content.
- **Mobile Experience and PWA**: A Spotify-style mobile layout with a bottom navigation bar on small screens, and installable to the home screen as a Progressive Web App.
- **Keyboard Shortcuts**: Global hotkeys for common playback actions.

### Internal and Technical Features

- **JWT Authentication**: Stateless session tokens signed with HMAC-SHA256 and valid for 30 days, with passwords hashed using scrypt (a per-user 16-byte salt and a 64-byte derived key), verified in constant time. No external authentication library is used.
- **Last.fm Recommendation Engine**: Expands listening seeds through Last.fm content-similarity endpoints and blends the results with popularity and recency signals.
- **Durable Background Job Queue**: A SQLite-backed, leased, de-duplicated job queue polled every 500 milliseconds, running up to 4 jobs in parallel, with up to 3 attempts per job and exponential backoff (a 60-second base multiplied by the attempt number). Crashed worker jobs are automatically reclaimed after the 300-second lease expires.
- **Three Background Job Types**: Track enrichment, user profile rebuilding, and homepage shelf building.
- **Multi-Level Caching**: In-memory LRU caches sized for up to 10,000 user profiles (5-minute TTL), 50,000 recommendation result sets (2-minute TTL, served stale while rebuilding), and 100,000 playback sessions (3-hour TTL), plus Tidal lookups; a persistent SQLite cache for Last.fm responses (30-day grace period); and a persistent Last.fm to Tidal entity-mapping cache (including a negative cache for entities confirmed not to exist on Tidal).
- **Colour Extraction**: Vibrant colour extraction from album and artist artwork (using node-vibrant, jimp, and fast-average-color) for UI theming.
- **Genre Preference Profiles**: Aggregates up to the 5,000 most recent interactions into weighted, recency-decayed genre preferences (the top 20 genres are kept) that drive personalised homepage sections.
- **Artist-Diversity Re-ranking**: Caps the number of tracks per artist in a result set to balance similarity against variety.
- **Metrics Endpoint**: An in-process metrics collector exposes request counts and per-route latency statistics (count, average, p50, p95, p99, and maximum) over a rolling reservoir of up to 1,000 samples per metric, with no external dependency.
- **API Documentation**: Swagger UI is served for live exploration of the API.

---

## Tech Stack

### Backend API and Worker

| Component        | Technology                             | Version             |
| ---------------- | -------------------------------------- | ------------------- |
| Runtime          | Node.js                                | 20+                 |
| Language         | TypeScript                             | 5.4.5               |
| Framework        | Fastify                                | 4.27.0              |
| ORM              | Prisma                                 | 7.8.0               |
| Database driver  | better-sqlite3                         | 12.8.0              |
| Prisma adapter   | @prisma/adapter-better-sqlite3         | 7.8.0               |
| Validation       | Zod                                    | 3.23.8              |
| Logging          | Pino                                   | 9.2.0               |
| Concurrency      | fastq, p-limit                         | 1.17.1, 5.0.0       |
| In-memory cache  | lru-cache                              | 10.2.2              |
| HTTP client      | axios                                  | 1.7.2               |
| Image processing | node-vibrant, jimp, fast-average-color | 3.1.6, 1.6.0, 9.5.0 |
| API docs         | @fastify/swagger, @fastify/swagger-ui  | 8.14.0, 4.0.0       |
| Testing          | Vitest                                 | 4.1.8               |

Authentication (JWT signing and verification, scrypt password hashing) is implemented directly with the Node.js standard library and needs no external package.

### Frontend

| Component     | Technology     | Version |
| ------------- | -------------- | ------- |
| Framework     | Next.js        | 16.1.6  |
| UI Library    | React          | 19.2.3  |
| Styling       | TailwindCSS    | 4.1.18  |
| Data Fetching | SWR            | 2.4.1   |
| Streaming     | Dash.js        | 4.7.4   |
| Compiler      | React Compiler | 1.0.0   |

The frontend also uses the browser-native Web Audio API for crossfade, gapless playback, and loudness normalisation, and registers a service worker for Progressive Web App support.

### hifi-api (Tidal Proxy Service)

| Component | Technology | Version |
| --------- | ---------- | ------- |
| Runtime   | Python     | 3.13    |
| Framework | FastAPI    | 0.135.2 |
| Server    | uvicorn    | 0.42.0  |
| HTTP      | httpx      | 0.28.1  |

### External Integrations

- **Tidal** (through the bundled hifi-api service): Music catalogue, search, album artwork, lyrics, and lossless or Hi-Res streaming manifests.
- **Last.fm**: Recommendations (similar tracks and artists), charts, artist and tag metadata, tags, and play counts.
- **MusicBrainz**: Canonical artist and release identifiers, and genre data for enrichment.

---

## System Architecture

Muse runs as four processes that communicate over HTTP and a shared SQLite database: the Node.js API server, the Node.js worker, the Python hifi-api service, and the Next.js frontend.

### Component Interaction

The **hifi-api service** runs on port 8000. It authenticates against Tidal once (storing a `token.json`) and then proxies catalogue metadata, search, cover art, lyrics, and streaming manifests.

The **Node.js API Server** runs on port 5000 and is the primary backend. It handles authentication, all client requests, the SQLite database, recommendation generation through Last.fm, and proxying of the hifi-api service. On startup it runs the Prisma schema sync, validates the hifi-api connection, and ensures a fallback development user exists.

The **Worker Process** polls the SQLite job queue every 500 milliseconds for `enrich_track`, `update_profile`, and `build_homepage` jobs, processing up to 4 at a time. Enrichment fetches Last.fm tags and MusicBrainz genre and identifiers; profile updates recompute the user's weighted genre preferences and then queue a homepage rebuild; homepage building writes fresh, personalised shelves to a persistent cache that stays fresh for 6 hours.

The **Next.js Frontend** runs on port 3000 in development, or serves a built application in production. It communicates only with the Node.js API and renders server-side for initial page loads.

### Data Flow

When a user plays a track, the frontend sends an interaction event to the API. The API stores it in the `UserInteraction` table and, for high-signal events (for example, a play completed beyond 80 percent, or a like), schedules a profile update job. The worker recomputes the user's weighted, recency-decayed genre preferences (using a 30-day decay window) and then triggers a homepage rebuild.

For recommendation generation, the API gathers the user's listening seeds from the database (up to 8 seed tracks and 4 seed artists), expands them through Last.fm's `track.getSimilar` and `artist.getSimilar` endpoints (requesting up to 30 similar items per seed), maps the resulting candidates to playable Tidal tracks (using the persistent Last.fm to Tidal mapping cache, with at most 44 Tidal lookups per request, resolved in batches of 5), filters out recently played items, caps results per artist for diversity, and ranks by Last.fm similarity plus popularity. Results are cached per surface for 2 minutes.

---

## Project Structure

```
Muse/
├── Backend/                              # Node.js API and worker
│   ├── prisma/
│   │   └── schema.prisma                 # SQLite schema (19 models)
│   ├── src/
│   │   ├── api/                          # Fastify route handlers
│   │   │   ├── actions.ts                # Toggle like / library / pin actions
│   │   │   ├── auth.ts                   # Signup, login, current user
│   │   │   ├── browse.ts                 # Search sections, recent searches, home
│   │   │   ├── contextMenu.ts            # Item state for context menus
│   │   │   ├── interactions.ts           # Play, skip, like, save events
│   │   │   ├── lastfm.ts                 # Last.fm artist and tag routes
│   │   │   ├── library.ts                # Library and playlist operations
│   │   │   ├── recommendations.ts        # Recommendations, queue, radio, homepage
│   │   │   ├── settings.ts               # User settings
│   │   │   ├── tidal.ts                  # hifi-api proxy, search, images, streams
│   │   │   ├── tracks.ts                 # Track ingest, metadata, enrichment
│   │   │   └── users.ts                  # Profile, top tracks, top artists
│   │   ├── cache/                        # In-memory LRU caches
│   │   ├── db/
│   │   │   ├── prisma.ts                 # Prisma client and SQLite adapter
│   │   │   ├── helpers.ts                # JSON serialisation helpers
│   │   │   └── repositories/             # Data access (users, jobs, catalog, etc.)
│   │   ├── services/                     # Business logic layer
│   │   │   ├── recommender.ts            # Last.fm recommendation engine
│   │   │   ├── profileBuilder.ts         # Genre-preference profile construction
│   │   │   ├── queueManager.ts           # Playback queue logic
│   │   │   ├── homepageBuilder.ts        # Personalised shelf generation
│   │   │   ├── homepageCache.ts          # Persistent homepage cache
│   │   │   ├── hifiClient.ts             # hifi-api (Tidal) client
│   │   │   ├── lastfmClient.ts           # Last.fm API client (SQLite-cached)
│   │   │   ├── musicbrainzClient.ts      # MusicBrainz genre and id client
│   │   │   ├── popularityService.ts      # Popularity scoring and Tidal resolution
│   │   │   ├── serviceMapping.ts         # Last.fm to Tidal entity mapping cache
│   │   │   ├── matching.ts               # Fuzzy and exact matching
│   │   │   └── artistFilters.ts          # Compilation artist detection
│   │   ├── workers/
│   │   │   ├── runner.ts                 # Job queue poller
│   │   │   └── jobs/                     # enrichTrack, updateProfile, buildHomepage
│   │   ├── auth.ts                       # Request authentication hook
│   │   ├── jwt.ts                        # JWT sign and verify (HS256)
│   │   ├── password.ts                   # Scrypt password hashing
│   │   ├── metrics.ts                    # Counters and latency percentiles
│   │   ├── config.ts                     # Environment configuration
│   │   └── index.ts                      # Application entry point
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   ├── package.json
│   └── tsconfig.json
├── Frontend/                             # Next.js application (App Router)
│   ├── app/                              # App Router pages
│   │   ├── login/                        # Login page
│   │   ├── signup/                       # Account creation page
│   │   ├── album/[id]/                   # Album detail page
│   │   ├── artist/[id]/                  # Artist detail page
│   │   ├── playlist/[id]/                # Playlist detail page
│   │   ├── discover/                     # Discovery surface
│   │   ├── library/                      # User library view
│   │   ├── liked/                        # Liked songs page
│   │   ├── search/                       # Search results
│   │   ├── profile/                      # User profile
│   │   ├── settings/                     # Application settings
│   │   ├── manifest.ts                   # PWA manifest
│   │   ├── layout.tsx                    # Root layout and providers
│   │   ├── page.tsx                      # Homepage
│   │   └── error.tsx                     # Error boundaries
│   ├── components/                       # React components
│   │   ├── ui/                           # Base UI components
│   │   ├── Player.tsx                    # Player bar
│   │   ├── NowPlaying.tsx                # Full-screen now playing view
│   │   ├── QueuePanel.tsx                # Queue with drag to reorder
│   │   ├── Lyrics.tsx                    # Lyrics panel
│   │   ├── Sidebar.tsx                   # Desktop navigation sidebar
│   │   ├── MobileNav.tsx                 # Mobile bottom navigation
│   │   ├── TopBar.tsx                    # Desktop header and search
│   │   ├── MediaCard.tsx                 # Album and artist cards
│   │   ├── MediaShelf.tsx                # Horizontal scroll shelf
│   │   ├── SongRow.tsx                   # Track list item
│   │   ├── AuthGate.tsx                  # Authentication guard
│   │   ├── GlobalHotkeys.tsx             # Keyboard shortcuts
│   │   └── ...
│   ├── context/                          # React contexts
│   │   ├── AuthContext.tsx               # Authentication state
│   │   ├── PlayerContext.tsx             # Playback state
│   │   ├── ToastContext.tsx              # Notifications
│   │   └── ActionMenuContext.tsx         # Context menus
│   ├── hooks/                            # Custom React hooks
│   ├── lib/                              # Utility functions
│   ├── public/                           # Static assets and service worker
│   ├── Dockerfile
│   └── package.json
├── hifi-api/                             # Python FastAPI Tidal proxy (vendored)
│   ├── main.py                           # FastAPI application
│   ├── tidal_auth/                       # One-time Tidal authentication
│   │   └── tidal_auth.py
│   ├── requirements.txt
│   └── Dockerfile
├── .github/workflows/ci.yml              # Continuous integration
├── docker-compose.yml
├── setup.ps1                             # Windows one-time setup
├── start.ps1                             # Windows stack launcher
├── package.json                          # Root orchestration scripts
├── .gitignore
└── .prettierrc.json
```

---

## Installation Guide

### Prerequisites

- Node.js 20 or later
- Python 3.11 or later (for the bundled `hifi-api/` service that proxies Tidal metadata and streaming)
- A Tidal account (the `hifi-api` service authenticates against it; see step 3 below)
- A Last.fm API key (required for recommendations and enrichment; obtain one at https://www.last.fm/api/account/create)

The `hifi-api/` directory is committed directly into this repository (it is vendored, not a submodule), so a plain `git clone` gives you everything you need.

### Step-by-Step Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Muse
   ```

2. **Install all Node.js dependencies** (Backend and Frontend)

   ```bash
   npm run install:all
   ```

   On Windows you can instead run `.\setup.ps1` from the repository root, which installs the Node.js dependencies, creates the Python virtual environment, and prepares the `Backend/.env` file.

3. **Set up and authenticate the hifi-api service**

   The Python service in `hifi-api/` provides Tidal metadata and streaming. Create a virtual environment, install its dependencies, and run the one-time Tidal login so it can store a `token.json`:

   ```bash
   cd hifi-api
   python -m venv .venv
   .venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS or Linux
   pip install -r requirements.txt
   pip install -r tidal_auth/requirements.txt
   python tidal_auth/tidal_auth.py   # follow the device-login prompt once
   cd ..
   ```

   On Windows, `.\setup.ps1` automates the virtual environment and authentication steps.

4. **Configure Environment Variables**

   Copy `Backend/.env.example` to `Backend/.env` and fill in the values marked REQUIRED. At a minimum you must set `LASTFM_API_KEY`, and a real `JWT_SECRET` for any shared deployment. The defaults assume the hifi-api service is on its standard port:

   ```env
   NODE_ENV=development
   PORT=5000
   API_BASE_URL=http://localhost:5000
   SQLITE_PATH=./data/music_rec.db
   TIDAL_API_BASE_URL=http://localhost:8000
   LASTFM_API_KEY=your_lastfm_key
   JWT_SECRET=change-me-to-a-long-random-string
   ```

5. **Build the Frontend** (production only)

   ```bash
   npm --prefix Frontend run build
   ```

---

## How to Use

### Starting the Services

The simplest option is to launch the entire stack from the repository root:

```bash
npm run dev
```

This runs the Prisma schema sync and then starts the hifi-api service, the API server, the worker, and the frontend together. If you do not need the hifi-api service in a given session, `npm run dev:core` starts only the API and the frontend.

On Windows, `.\start.ps1` opens each process in its own window.

To run the components manually, use a separate terminal for each:

**Terminal 1 - hifi-api Service:**

```bash
cd hifi-api
.venv/Scripts/activate            # or `source .venv/bin/activate`
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

**Terminal 2 - API Server:**

```bash
cd Backend
npm run dev
```

**Terminal 3 - Worker Process:**

```bash
cd Backend
npm run worker
```

**Terminal 4 - Frontend (Development):**

```bash
cd Frontend
npm run dev
```

Then open `http://localhost:3000` in your browser.

### Using the Application

1. **Create an Account**: On first use, sign up with your email address and a password (minimum eight characters), or log in if you already have an account.

2. **Browse Music**: The homepage displays personalised shelves. Click any album or artist card to view its details.

3. **Play Music**: Click the play button on any track. The persistent player bar at the bottom shows the current track and controls. Open the full-screen "Now Playing" view to see the queue and lyrics.

4. **Create Playlists**: Right-click a track and select "Add to Playlist", or use the library page to create new playlists.

5. **Like Songs and Save Items**: Click the heart icon on any track to add it to your liked songs, and save albums or artists to your library. Pin items to keep them at the top of the sidebar.

6. **Search**: Use the search bar to find tracks, albums, artists, and playlists. Your recent searches are remembered.

7. **Discover**: Visit the discover page to browse by genre and explore the global chart.

8. **Adjust Settings**: Open settings to change streaming and download quality, gapless playback, crossfade, automix, volume normalisation, data saver, and explicit content options.

---

## Developer Guide

### Running Locally

The development setup runs four processes. The root `npm run dev` starts them together using `concurrently`; you can also run each manually as shown above.

Recommended workflow:

1. Start the hifi-api service (the Node API validates this connection on startup)
2. Start the API server (its `predev` hook runs `prisma db push` to sync the schema)
3. Start the worker (it begins polling for jobs)
4. Start the frontend (it talks to the API)

### Development Commands

Run these from the `Backend` directory unless noted:

| Command                   | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `npm run dev`             | Start the API server with hot reload               |
| `npm run worker`          | Start the job queue processor                      |
| `npm run build`           | Generate the Prisma client and compile TypeScript  |
| `npm run db:push`         | Sync the Prisma schema to SQLite                   |
| `npm run db:studio`       | Open Prisma Studio to inspect the database         |
| `npm test`                | Run the Vitest test suite                          |
| `npm run lint`            | Run ESLint                                         |
| `npm run typecheck`       | Type-check without emitting                        |
| `npm run dev` (root)      | Start hifi-api, API, worker, and frontend together |
| `npm run dev:core` (root) | Start only the API and the frontend                |

### Code Organisation Principles

- **API Routes**: Each domain has its own route file in `src/api/`. Routes handle HTTP and authorisation concerns only and delegate to services and repositories.
- **Services**: Business logic lives in `src/services/`. Services have no HTTP knowledge.
- **Repositories**: All database access is centralised in `src/db/repositories/`.
- **Database**: SQLite is accessed through Prisma with the better-sqlite3 adapter. The schema lives in `Backend/prisma/schema.prisma`, and `prisma db push` syncs it (run automatically by the `predev` script locally and by the Docker entrypoint).
- **Workers**: Jobs are idempotent and can be retried. Each job type has a handler in `src/workers/jobs/`.

---

## Configuration Guide

### Environment Variables

The most commonly changed variables are listed below. The full list, with comments, is in `Backend/.env.example`.

| Variable               | Default                           | Description                                        |
| ---------------------- | --------------------------------- | -------------------------------------------------- |
| `NODE_ENV`             | `development`                     | Runtime environment                                |
| `PORT`                 | `5000`                            | API server port                                    |
| `API_BASE_URL`         | `http://localhost:5000`           | Public API URL                                     |
| `LOG_LEVEL`            | `info`                            | Pino log level                                     |
| `SQLITE_PATH`          | `./data/music_rec.db`             | Database file location                             |
| `TIDAL_API_BASE_URL`   | `http://localhost:8000`           | hifi-api service base URL                          |
| `LASTFM_API_KEY`       | _(none)_                          | Last.fm API key (recommendations and enrichment)   |
| `MUSICBRAINZ_APP`      | `MusicRecEngine/1.0`              | MusicBrainz User-Agent app string                  |
| `DEV_USER_ID`          | `dev-user-001`                    | Development-only fallback identity (no token)      |
| `JWT_SECRET`           | _(insecure default; set in prod)_ | HMAC secret for signing session tokens             |
| `JWT_TTL_SEC`          | `2592000`                         | Session token lifetime (30 days)                   |
| `JOB_MAX_ATTEMPTS`     | `3`                               | Maximum retries per background job                 |
| `JOB_RETRY_BASE_SEC`   | `60`                              | Base backoff between job retries                   |
| `JOB_LEASE_SEC`        | `300`                             | Job lease before reclaiming a crashed worker's job |
| `WORKER_POLL_MS`       | `500`                             | Job polling interval                               |
| `WORKER_CONCURRENCY`   | `4`                               | Parallel job limit                                 |
| `QUEUE_SIZE`           | `25`                              | Default queue length                               |
| `QUEUE_LOW_WATER_MARK` | `5`                               | Refill the queue when it falls below this          |
| `HOME_REC_COUNT`       | `20`                              | Recommendations per shelf                          |
| `MIX_TRACK_COUNT`      | `30`                              | Tracks per generated mix                           |
| `RECENCY_DECAY_DAYS`   | `30`                              | History decay period                               |
| `CACHE_PROFILE_TTL_MS` | `300000`                          | Profile cache TTL (5 minutes)                      |
| `CACHE_REC_TTL_MS`     | `120000`                          | Recommendation cache TTL (2 minutes)               |
| `HOMEPAGE_FRESH_SEC`   | `21600`                           | Homepage cache freshness window (6 hours)          |

Additional tuning variables control recommender behaviour (`SEED_TRACK_CAP`, `SEED_ARTIST_CAP`, `SIMILAR_PER_TRACK`, `MAX_TIDAL_LOOKUPS`, `TIDAL_RESOLVE_BATCH`, `PROFILE_MAX_GENRES`), session handling (`SESSION_TTL_MS`, `PLAYED_IDS_HISTORY_CAP`, `HIGH_SIGNAL_COMPLETION_RATIO`), and homepage building (`SECTION_ITEM_COUNT`, `COLLECTION_TRACK_COUNT`, `TRACK_POOL_SIZE`).

---

## Core Workflows

### Track Playback Flow

When a user clicks play on a track:

1. The frontend requests the track's stream manifest from the API, which proxies the hifi-api service.
2. Dash.js initialises the media player with the manifest, and the Web Audio API handles fade-in, crossfade, and optional loudness normalisation.
3. As audio plays, the frontend periodically sends interaction events to the API.
4. The API records play duration, completion ratio, and context in `UserInteraction`.
5. For high-signal events (a like, or a play completed beyond 80 percent), a profile update job is queued.
6. The worker recomputes the user's weighted genre preferences and then queues a homepage rebuild.

### Recommendation Generation Flow

When recommendations are requested (homepage shelves, queue, or radio):

1. The API gathers the user's listening seeds (recent plays, likes, and saved tracks) from the database, capped at 8 seed tracks and 4 seed artists.
2. Seed tracks are expanded through Last.fm `track.getSimilar`, and seed artists through `artist.getSimilar` followed by `artist.getTopTracks`, requesting up to 30 similar items per seed.
3. Candidates are aggregated and ranked by Last.fm similarity (the `match` value) plus popularity.
4. Each candidate is mapped to a playable Tidal track (using the persistent mapping cache, with at most 44 Tidal lookups per request resolved in batches of 5) and persisted to the catalogue.
5. Recently played tracks and duplicates are filtered out.
6. Results are capped per artist for diversity and trimmed to the surface limit (for example, 20 items per homepage shelf, or a queue of 25).
7. New users with no seeds fall back to Last.fm charts.
8. The final list is cached per surface for 2 minutes and returned.

### Track Enrichment Flow

When a new track enters the system:

1. An `enrich_track` job is queued.
2. Last.fm tags and play count are fetched for the track.
3. MusicBrainz resolves canonical identifiers and genre.
4. Genre is derived (the MusicBrainz genre, falling back to the top Last.fm tag).
5. Tags, genre, and identifiers are written to `TrackFeatures`, and the track is marked enriched.

---

## API and Module Behaviour

### Authentication

Authentication uses stateless JWTs. `POST /auth/signup` and `POST /auth/login` return a token, and `GET /auth/me` resolves the current user. The frontend stores the token in `localStorage` and attaches it to every request as `Authorization: Bearer <token>`. Routes that act on personal data verify that the token's user matches the requested user, returning HTTP 403 otherwise. In development only, the API falls back to an `x-user-id` header and then to the `DEV_USER_ID` value when no token is present; in production there is no fallback.

### REST API Structure

The API follows REST conventions with these main resource groups:

- **Auth**: `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`.
- **Users**: `GET /users/:userId/profile`, `POST /users/:userId/profile/rebuild`, `GET /users/:userId/top-tracks`, `GET /users/:userId/top-artists`.
- **Recommendations**: `GET /users/:userId/recommendations` (with a surface parameter, an optional seed track, and a limit), `POST /users/:userId/queue/init`, `POST /users/:userId/queue/update`, `GET /users/:userId/queue`, `GET /users/:userId/radio/seeds`, `GET /users/:userId/homepage` and its `/debug` variant.
- **Interactions**: `POST /users/:userId/interactions` records plays, skips, likes, saves, and follows.
- **Library and Playlists**: `GET/POST/DELETE /library`, `GET/POST /playlists`, `DELETE /playlists/:id`, and `GET/POST/DELETE /playlists/:id/tracks`.
- **Actions**: `POST /actions/toggle_like`, `POST /actions/toggle_library`, `POST /actions/toggle_pin`.
- **Settings**: `GET /settings` and `PUT /settings`.
- **Browse**: `GET /browse/search-sections`, `GET /browse/recent-searches`, `POST /browse/searches`, `GET /browse/home`.
- **Context Menu**: `GET /context-menu/:type/:id` returns item state (in library, pinned).
- **Tracks**: `POST /tracks/ingest`, `GET /tracks/:trackId`, `POST /tracks/:trackId/enrich`.
- **Tidal Proxy**: `GET /tidal/search`, `GET /tidal/tracks/:id`, `GET /tidal/tracks/:id/stream`, `GET /tidal/albums/:id`, `GET /tidal/artists/:id`, `GET /tidal/playlists/:id`, `GET /tidal/images/*` (with colour extraction), `GET /tidal/genres`, and related endpoints.
- **Last.fm**: `GET /lastfm/artist/:artistName` returns artist info with Tidal-validated similar artists, and `GET /lastfm/tag/:tagName` and `GET /lastfm/tag/:tagName/similar` return tag metadata.
- **Infrastructure**: `GET /health` for liveness, `GET /metrics` for request counts and per-route latency statistics (count, average, p50, p95, p99, and maximum over the last 1,000 samples), and Swagger UI at `/docs`.

### Data Model

The Prisma schema defines 19 models: `User`, `UserSetting`, `Artist`, `Album`, `Track`, `TrackFeatures`, `UserInteraction`, `UserProfile`, `SessionQueue`, `Job`, `Recommendation`, `UserLibrary`, `Playlist`, `PlaylistTrack`, `SearchHistory`, `LastfmCache`, `ServiceMapping`, `HomepageCache`, and `ShelfImpression`.

---

## Testing

The backend has a Vitest suite (`npm test` in `Backend/`) covering JWT auth, scrypt password hashing, metrics and latency percentiles, database JSON helpers, compilation artist filters, the fuzzy and exact matching algorithms, and the popularity service. Continuous integration runs type checking, linting, and tests for the backend, and linting, type checking, and a production build for the frontend, on every push and pull request to `main`.

Beyond the automated suite, manual testing is supported through:

1. **API Exploration**: Use the Swagger UI at `/docs` while the API is running locally.
2. **Homepage Debug Endpoint**: `GET /users/:userId/homepage/debug` returns diagnostic information about shelf generation.
3. **Metrics Endpoint**: `GET /metrics` reports request counts and latency statistics (count, average, p50, p95, p99, and maximum) over the last 1,000 samples per metric.
4. **Health Check**: `GET /health` verifies that the server is up.

To verify recommendations are working:

1. Ensure `LASTFM_API_KEY` is set and the catalogue has tracks.
2. Generate some play history through the interface.
3. Check that the homepage loads with personalised shelves.
4. Use the debug endpoint to confirm shelf and mix sizes (by default, 10 items per shelf and 50 tracks per collection or mix).

---

## Deployment Overview

### Production Considerations

1. **Build**: Run `npm run build` at the root to build both the Backend and the Frontend.
2. **Environment Variables**: Ensure all required variables are set, especially a strong `JWT_SECRET` and a valid `LASTFM_API_KEY`.
3. **Database**: Place the SQLite file on persistent storage.
4. **Process Management**: Use a process manager such as PM2, systemd, or Docker to manage the API, worker, and hifi-api processes.

### Docker Deployment

The repository ships a complete Docker setup: a root `docker-compose.yml` plus Dockerfiles for `Backend/`, `Frontend/`, and `hifi-api/`. To bring up the whole stack (hifi-api, the backend API, the worker, and the frontend):

```bash
cp Backend/.env.example Backend/.env   # fill in LASTFM_API_KEY, JWT_SECRET, and so on
docker compose up --build
```

The backend image's entrypoint (`Backend/docker-entrypoint.sh`) runs `prisma db push` on start, so the schema is created automatically on a fresh volume. The API and the worker share a named SQLite volume. For a production deployment, place the stack behind a reverse proxy (such as nginx or traefik) for SSL termination and routing.

The four compose services and their ports are: hifi-api (8000), the backend API (5000), the backend worker (internal only), and the frontend (3000).

---

## Performance and Design Considerations

### Caching Strategy

Several layers of caching improve response times:

1. **In-Memory LRU**: User profiles (up to 10,000 entries, 5-minute TTL), recommendation results (up to 50,000 entries, 2-minute TTL, served stale while rebuilding), playback sessions (up to 100,000 entries, 3-hour TTL), and Tidal lookups are cached in memory.
2. **Persistent Last.fm Cache**: All Last.fm responses are cached in SQLite, keyed by method and parameters, with a 30-day grace period before cleanup.
3. **Persistent Service Mapping Cache**: Last.fm to Tidal entity resolutions are cached in SQLite, including a negative cache for entities confirmed not to be on Tidal, which avoids repeated failed lookups.
4. **Persistent Homepage Cache**: Built homepage shelves are written to the database and served while fresh (a 6-hour window).
5. **SQLite Pragmas**: Query caching through pragmas (a larger cache size and memory-mapped I/O).

### Database Optimisations

SQLite is configured at startup with WAL mode for concurrent reads during writes, `synchronous = NORMAL`, a 64 MB page cache (`cache_size = -65536`), in-memory temporary storage, 256 MB of memory-mapped I/O (`mmap_size`), a WAL auto-checkpoint every 1,000 pages, and foreign keys enabled. Indexes cover foreign keys and common query patterns, including interaction lookups by user, event type, and time.

### Recommendation Latency

Recommendation latency is dominated by outbound Last.fm and Tidal calls. To keep responses fast:

- Results are cached per surface in memory for 2 minutes.
- Seed expansion fans out across Last.fm endpoints in parallel (up to 8 seed tracks and 4 seed artists, 30 similar items each).
- Tidal resolution is batched (5 at a time) with a hard cap of 44 lookups per request, and uses the persistent mapping cache for zero-network hits.
- Genre-preference profiles are cached in memory for 5 minutes.

### Trade-offs

1. **SQLite versus PostgreSQL**: SQLite was chosen for simplicity in single-node deployments. It limits horizontal scaling but removes network overhead and configuration complexity.

2. **Last.fm Similarity versus Local Models**: Recommendations rely on Last.fm's crowd-sourced listening data rather than a local machine-learning model. This removes all model and inference infrastructure at the cost of a network dependency and per-request API calls.

3. **Client-Side versus Server-Side Rendering**: The Next.js App Router provides server-side rendering for initial loads, improving first paint, at the cost of server compute.

---

## Known Limitations

1. **Tidal Dependency**: Music metadata and streaming require the running hifi-api service and a valid Tidal account. The application cannot stream audio without it.

2. **Last.fm Dependency**: Personalised recommendations require a Last.fm API key and network access. Without it, the system falls back to local database popularity.

3. **No Native Mobile Application**: The interface is web only, although it is mobile-responsive and installable as a Progressive Web App. There are no native iOS or Android applications.

4. **Catalogue Population**: The catalogue grows as tracks are ingested and resolved from Last.fm and Tidal. There is no bundled bulk seed script.

5. **No Collaborative Filtering**: Recommendations are based on content similarity (Last.fm) and popularity. True collaborative filtering across users is not implemented.

6. **Single-Node Design**: The SQLite-based design targets a single node. Running multiple API instances against the same database file is not supported.

---

## Troubleshooting

### Homepage Shows No Content

- Verify the database has tracks by checking the API logs for the dataset row counts printed at startup.
- Ensure `LASTFM_API_KEY` is set so the trending and recommendation fallbacks work.
- Verify the hifi-api service is reachable, since recommendations resolve candidates to Tidal.

### Playback Does Not Start

- Verify the hifi-api service is reachable from the backend.
- Check the browser console for Dash.js errors.
- Ensure the track has a valid Tidal ID in the database.

### Recommendations Feel Repetitive

- Build up more listening history (likes and saves are stronger seeds than plays).
- Clear the recommendation cache by restarting the API server.
- Confirm Last.fm is reachable, since without it the results fall back to popularity.

### Recommendations Are Empty

- Confirm `LASTFM_API_KEY` is valid (the client logs a warning when it is missing).
- Check that seed tracks have a resolvable artist name in the catalogue.
- Verify outbound network access to `ws.audioscrobbler.com`.

### Login or Signup Fails

- Confirm `JWT_SECRET` is set and consistent across restarts (changing it invalidates existing tokens).
- Ensure passwords are at least eight characters long.
- Check that the database is writable at the configured `SQLITE_PATH`.

---

## Contribution Guide

### Getting Started

1. Fork the repository and clone your fork.
2. Follow the [Installation Guide](#installation-guide) to set up your development environment.
3. Create a feature branch: `git checkout -b feature/your-feature-name`.

### Code Style

- **TypeScript**: Strict mode is enabled. Avoid `any` types outside the SQL boundary.
- **Formatting**: A Prettier configuration is included (tabs, width two). Run `npx prettier --write` before committing.
- **Linting**: ESLint is configured for both the Backend and the Frontend. Fix all warnings.

### Making Changes

1. **Small, Focused Commits**: Each commit should address one concern.
2. **No Breaking Changes**: Maintain backward compatibility for API responses where possible.
3. **Update Documentation**: Update this README if your change affects setup or configuration.
4. **Test Manually**: Verify your changes work with a full local stack, and ensure `npm test`, `npm run lint`, and `npm run typecheck` pass.

### Pull Request Process

1. Push your branch to your fork.
2. Open a pull request with a clear description of the changes.
3. Reference any related issues.
4. Respond to review feedback promptly. Continuous integration must pass before merge.

### Areas for Contribution

- **Mobile Responsiveness**: Continue refining the tablet and mobile layouts.
- **Playlist Collaboration**: Allow multiple users to edit a shared playlist.
- **Import and Export**: Support importing playlists from external sources or exporting to M3U.
- **Expanded Keyboard Shortcuts**: Add more global keyboard controls.
- **Lyrics Improvements**: Add synced (time-aligned) lyrics where available.

---

## Roadmap and Future Improvements

Potential enhancements based on the current architecture:

1. **Multi-User Hardening**: Account recovery, email verification, and role-based access.
2. **Collaborative Filtering**: Cross-user recommendation signals in addition to content similarity.
3. **Real-Time Features**: WebSocket integration for collaborative listening sessions.
4. **Plugin System**: Third-party integrations for lyrics, concerts, and related content.
5. **Analytics Dashboard**: Visualise listening patterns and recommendation effectiveness.

---

## Community Value

Muse demonstrates a complete, production-quality music streaming implementation that anyone can self-host. It bridges the gap between proprietary streaming services and bare-bones media servers by providing:

- **Smart Discovery**: Last.fm-powered similarity recommendations comparable to commercial platforms.
- **Data Ownership**: All listening history and preferences stored locally.
- **Educational Value**: Complete source code for learning full-stack TypeScript, background job processing, authentication, and music-API integration.
- **Hackability**: A clean, layered architecture that allows easy extension and customisation.

Developers interested in recommendation systems, audio streaming, or modern React patterns will find the codebase informative. Music enthusiasts gain a personalised streaming experience without subscription fees or data collection concerns.
