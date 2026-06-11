# Muse

A self-hosted music streaming and discovery platform that combines Last.fm-powered recommendations with high-fidelity audio streaming.

---

## Audience Navigation Guide

**For Recruiters**: Jump to [Overview](#overview), [Tech Stack](#tech-stack), and [System Architecture](#system-architecture) to understand the engineering scope and technical decisions.

**For Developers**: See [Developer Guide](#developer-guide), [Core Workflows](#core-workflows), and [Project Structure](#project-structure) for implementation details.

**For End Users**: Start with [How to Use](#how-to-use) and [Installation Guide](#installation-guide) to get the application running.

**For Contributors**: Read [Contribution Guide](#contribution-guide) and [Known Limitations](#known-limitations) before submitting changes.

---

## Overview

Muse is a full-stack music streaming application designed for personal media libraries. It provides an interface similar to commercial streaming services, but runs entirely on your own infrastructure.

### For Non-Technical Readers

Muse lets you browse, search, and play music from your collection through a web browser. It learns your preferences over time and suggests songs you might enjoy. The interface includes a homepage with personalised recommendations, artist pages, album views, playlists, and a persistent playback bar at the bottom of the screen.

### For Technical Readers

The system implements a two-tier architecture:

1. **API Layer (Node.js + TypeScript)**: Fastify-based REST API handling user interactions, library management, playlist operations, recommendation generation, and background enrichment. SQLite with WAL mode serves as the primary datastore. A SQLite-backed job queue processes track enrichment and profile updates in a separate worker process.

2. **Frontend (Next.js + React)**: Server-rendered React application using the App Router pattern. Dash.js handles MPEG-DASH adaptive streaming. TailwindCSS provides the styling system.

The recommendation engine is powered by **Last.fm**. Personalised suggestions are generated from the user's listening seeds (recent plays, likes, and saved library tracks) via Last.fm's content-similarity endpoints (`track.getSimilar` and `artist.getSimilar` → `artist.getTopTracks`). Candidates are mapped to playable Tidal tracks, de-duplicated, capped per artist for diversity, and ranked by Last.fm similarity and popularity. New users fall back to Last.fm charts.

---

## Problem Statement

Commercial streaming services lock users into proprietary ecosystems with limited control over recommendations and no access to personal listening data. Self-hosted alternatives often lack polished interfaces or intelligent discovery features.

Muse addresses these gaps by providing:

- Complete data ownership through local SQLite storage
- Transparent recommendation algorithms that can be inspected and modified
- A responsive, modern interface comparable to commercial offerings
- Integration with existing music metadata services (Tidal API, Last.fm) for enrichment
- No subscription fees or vendor lock-in

---

## Key Features

### User-Facing Features

- **Personalised Homepage**: Dynamic shelves including "Made For You" mixes, favourite artist recommendations, daily mixes, and discovery sections
- **Adaptive Audio Streaming**: MPEG-DASH protocol for efficient audio delivery with quality adaptation
- **Smart Queue Management**: Intelligent queue generation that adapts based on listening patterns and current track context
- **Radio Mode**: Continuous playback based on seed tracks with similarity-based track selection
- **Library Management**: Like tracks, create playlists, pin favourites, and browse by artist or album
- **Search with History**: Full-text search across tracks, albums, and artists with recent search tracking
- **Context Menus**: Right-click actions for tracks, albums, and artists including add to playlist, add to queue, and go to artist

### Internal / Technical Features

- **Last.fm Recommendation System**: Expands listening seeds via Last.fm content-similarity endpoints, blended with popularity and recency signals
- **Background Job Processing**: SQLite-backed job queue for track enrichment and profile updates
- **Multi-Level Caching**: LRU caches for user profiles and recommendation results with configurable TTL
- **Color Extraction**: Automatic vibrant color extraction from album artwork for UI theming
- **Genre Preference Profiles**: Aggregates user listening history into weighted genre preferences for personalised homepage sections
- **Artist-Diversity Re-ranking**: Caps tracks per artist in a result set to balance similarity with variety

---

## Tech Stack

### Backend Services

| Component   | Technology     | Version |
| ----------- | -------------- | ------- |
| Runtime     | Node.js        | 20+     |
| Language    | TypeScript     | 5.4.5   |
| Framework   | Fastify        | 4.27.0  |
| Database    | better-sqlite3 | 12.8.0  |
| Validation  | Zod            | 3.23.8  |
| Logging     | Pino           | 9.2.0   |
| Queue       | fastq          | 1.17.1  |
| HTTP Client | axios          | 1.7.2   |

### Frontend

| Component     | Technology     | Version |
| ------------- | -------------- | ------- |
| Framework     | Next.js        | 16.1.6  |
| UI Library    | React          | 19.2.3  |
| Styling       | TailwindCSS    | 4.1.18  |
| Data Fetching | SWR            | 2.4.1   |
| Streaming     | Dash.js        | 4.7.4   |
| Compiler      | React Compiler | 1.0.0   |

### External Integrations

- **Tidal API**: Music metadata, album artwork, and streaming URLs
- **Last.fm**: Recommendations (similar tracks/artists), charts, artist tags, and play counts
- **MusicBrainz**: Canonical artist and release identifiers, genre

---

## System Architecture

Muse runs as two application processes (API server and background worker) plus the Next.js frontend, communicating over HTTP and a shared SQLite database.

### Component Interaction

The **Node.js API Server** runs on port 5000 and serves as the primary backend. It handles all client requests, manages the SQLite database, enqueues background jobs, generates recommendations via Last.fm, and proxies the Tidal API. On startup, it runs database migrations, validates the Tidal API connection, and ensures a development user exists.

The **Worker Process** polls the SQLite job queue for track-enrichment and profile-update jobs. Enrichment fetches Last.fm tags and MusicBrainz genre/identifiers; profile updates recompute the user's weighted genre preferences.

The **Next.js Frontend** runs on port 3000 (development) or serves static files in production. It communicates exclusively with the Node.js API and renders server-side for initial page loads.

### Data Flow

When a user plays a track, the frontend sends an interaction event to the API. The API stores this in the `user_interactions` table and (for high-signal events) schedules a profile update job. The worker process picks up the job and recomputes the user's weighted genre preferences.

For recommendation generation, the API gathers the user's listening seeds from the database, expands them through Last.fm's `track.getSimilar` / `artist.getSimilar` endpoints, maps the resulting candidates to playable Tidal tracks, filters out recently played items, caps results per artist for diversity, and ranks by Last.fm similarity plus popularity. Results are cached per surface with a short TTL.

---

## Project Structure

```
Muse/
├── Backend/                              # Node.js API and worker system
│   ├── src/
│   │   ├── api/                          # Fastify route handlers
│   │   │   ├── actions.ts                # Playlist/library actions
│   │   │   ├── browse.ts                 # Browse by category endpoints
│   │   │   ├── contextMenu.ts            # Context menu options
│   │   │   ├── interactions.ts           # Play events, likes, history
│   │   │   ├── lastfm.ts                 # Last.fm integration routes
│   │   │   ├── library.ts                # User library operations
│   │   │   ├── recommendations.ts        # Rec endpoints, queue management
│   │   │   ├── tidal.ts                  # Tidal API proxy and image handling
│   │   │   ├── tracks.ts                 # Track metadata endpoints
│   │   │   └── users.ts                  # User management
│   │   ├── cache/                        # LRU cache implementations
│   │   ├── db/                           # Database client and migrations
│   │   ├── services/                     # Business logic layer
│   │   │   ├── hifiClient.ts             # Audio streaming client
│   │   │   ├── homepageBuilder.ts        # Personalised shelf generation
│   │   │   ├── lastfmClient.ts           # Last.fm API client
│   │   │   ├── musicbrainzClient.ts      # MusicBrainz genre/id client
│   │   │   ├── popularityService.ts      # Last.fm popularity → Tidal mapping
│   │   │   ├── profileBuilder.ts         # Genre-preference profile construction
│   │   │   ├── queueManager.ts           # Playback queue logic
│   │   │   └── recommender.ts            # Last.fm recommendation engine
│   │   ├── types/                        # TypeScript type definitions
│   │   ├── workers/                      # Background job processing
│   │   │   ├── runner.ts                 # Job queue poller
│   │   │   └── jobs/                     # Job handlers (enrich, update profile)
│   │   ├── config.ts                     # Environment configuration
│   │   └── index.ts                      # Application entry point
│   ├── lastfm_helper/                    # Last.fm API endpoint documentation
│   ├── package.json
│   └── tsconfig.json
├── Frontend/                             # Next.js application with App Router
│   ├── app/                              # App Router pages
│   │   ├── album/[id]/                   # Album detail page
│   │   ├── artist/[id]/                  # Artist detail page
│   │   ├── discover/                     # Discovery surface
│   │   ├── library/                      # User library view
│   │   ├── liked/                        # Liked songs page
│   │   ├── playlist/[id]/                # Playlist detail page
│   │   ├── profile/                      # User profile
│   │   ├── search/                       # Search results
│   │   ├── settings/                     # Application settings
│   │   ├── globals.css                   # Global styles
│   │   ├── layout.tsx                    # Root layout
│   │   ├── page.tsx                      # Homepage
│   │   └── error.tsx                     # Error boundaries
│   ├── components/                       # React components
│   │   ├── ui/                           # Base UI components
│   │   ├── Player.tsx                    # Playback controls
│   │   ├── Sidebar.tsx                   # Navigation sidebar
│   │   ├── TopBar.tsx                    # Search and header
│   │   ├── MediaCard.tsx                 # Album/artist cards
│   │   ├── MediaShelf.tsx                # Horizontal scroll shelf
│   │   ├── SongRow.tsx                   # Track list item
│   │   └── ...
│   ├── context/                          # React contexts
│   │   ├── PlayerContext.tsx             # Playback state
│   │   └── ActionMenuContext.tsx         # Context menus
│   ├── hooks/                            # Custom React hooks
│   │   ├── useColorExtraction.ts
│   │   ├── useLibraryManager.ts
│   │   ├── usePlaybackProgress.ts
│   │   ├── usePlaylistManager.ts
│   │   └── ...
│   ├── lib/                              # Utility functions
│   └── package.json
├── .gitignore
└── .prettierrc.json
```

---

## Installation Guide

### Prerequisites

- Node.js 20 or later
- A Tidal API instance (local or remote) for music metadata and streaming
- Last.fm API key (required for recommendations; get one at https://www.last.fm/api/account/create)

### Step-by-Step Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Muse
   ```

2. **Install all dependencies** (root, Backend, Frontend)

   ```bash
   npm run install:all
   ```

   On Windows you can instead run `.\setup.ps1` from the repo root.

3. **Configure Environment Variables**

   Create a `.env` file in the `Backend` directory:

   ```env
   NODE_ENV=development
   PORT=5000
   API_BASE_URL=http://localhost:5000
   SQLITE_PATH=./data/music_rec.db
   TIDAL_API_BASE_URL=http://localhost:4000
   LASTFM_API_KEY=your_lastfm_key
   ```

4. **Build the Frontend** (production only)

   ```bash
   npm --prefix Frontend run build
   ```

---

## How to Use

### Starting the Services

The simplest option is to launch everything from the repo root:

```bash
npm run dev
```

On Windows, `.\start.ps1` opens each process in its own window. To run the three
components manually, each in a separate terminal:

**Terminal 1 - API Server:**

```bash
cd Backend
npm run dev
```

**Terminal 2 - Worker Process:**

```bash
cd Backend
npm run worker
```

**Terminal 3 - Frontend (Development):**

```bash
cd Frontend
npm run dev
```

Then open `http://localhost:3000` in your browser.

### Using the Application

1. **Browse Music**: The homepage displays personalised shelves. Click any album or artist card to view details.

2. **Play Music**: Click the play button on any track. The persistent player bar at the bottom shows current playback.

3. **Create Playlists**: Right-click tracks and select "Add to Playlist" or use the library page to create new playlists.

4. **Like Songs**: Click the heart icon in the player or on any track to add it to your liked songs.

5. **Search**: Use the search bar in the top navigation to find tracks, albums, or artists.

6. **Discover**: Visit the discover page for recommendations outside your usual listening patterns.

---

## Developer Guide

### Running Locally

The development setup runs three processes. The root `npm run dev` starts them
together via `concurrently`; you can also run each manually.

Recommended workflow:

1. Start the API server (it runs migrations and validates connections)
2. Start the worker (it begins polling for jobs)
3. Start the frontend (it proxies API requests)

### Development Commands

Run from the `Backend` directory unless noted:

| Command              | Purpose                                |
| -------------------- | -------------------------------------- |
| `npm run dev`        | Start API with hot reload              |
| `npm run worker`     | Start job queue processor              |
| `npm run build`      | Compile TypeScript                     |
| `npm run dev` (root) | Start API + worker + frontend together |

### Code Organisation Principles

- **API Routes**: Each domain has its own route file in `src/api/`. Routes handle HTTP concerns only and delegate to services.
- **Services**: Business logic lives in `src/services/`. Services are pure functions or classes with no HTTP knowledge.
- **Database**: Raw SQL via better-sqlite3. No ORM. Migrations run automatically on startup.
- **Workers**: Jobs are idempotent and can be retried. Each job type has a handler in `src/workers/jobs/`.

---

## Configuration Guide

### Environment Variables

| Variable               | Default                 | Description                          |
| ---------------------- | ----------------------- | ------------------------------------ |
| `NODE_ENV`             | `development`           | Runtime environment                  |
| `PORT`                 | `5000`                  | API server port                      |
| `API_BASE_URL`         | `http://localhost:5000` | Public API URL                       |
| `SQLITE_PATH`          | `./data/music_rec.db`   | Database file location               |
| `TIDAL_API_BASE_URL`   | `http://localhost:4000` | Tidal API endpoint                   |
| `LASTFM_API_KEY`       | _(none)_                | Last.fm API key (recommendations)    |
| `MUSICBRAINZ_APP`      | `MusicRecEngine/1.0`    | MusicBrainz User-Agent app string    |
| `LOG_LEVEL`            | `info`                  | Pino log level                       |
| `QUEUE_SIZE`           | `25`                    | Default queue length                 |
| `HOME_REC_COUNT`       | `20`                    | Recommendations per shelf            |
| `MIX_TRACK_COUNT`      | `30`                    | Tracks per generated mix             |
| `RECENCY_DECAY_DAYS`   | `30`                    | History decay period                 |
| `CACHE_PROFILE_TTL_MS` | `300000`                | Profile cache TTL (5 minutes)        |
| `CACHE_REC_TTL_MS`     | `120000`                | Recommendation cache TTL (2 minutes) |
| `WORKER_POLL_MS`       | `500`                   | Job polling interval                 |
| `WORKER_CONCURRENCY`   | `4`                     | Parallel job limit                   |

---

## Core Workflows

### Track Playback Flow

When a user clicks play on a track:

1. The frontend loads the track's audio manifest from the Tidal API via the backend proxy
2. Dash.js initialises the media player with the manifest URL
3. As audio plays, the frontend periodically sends interaction events to the API
4. The API records play duration, completion ratio, and context in user_interactions
5. For high-signal events, a profile update job is queued
6. The worker recomputes the user's weighted genre preferences from all interactions

### Recommendation Generation Flow

When recommendations are requested (homepage shelves, queue, radio):

1. The API gathers the user's listening seeds (recent plays, likes, saved tracks) from the database
2. Seed tracks are expanded via Last.fm `track.getSimilar`; seed artists via `artist.getSimilar` → `artist.getTopTracks`
3. Candidates are aggregated and ranked by Last.fm similarity (`match`) plus popularity
4. Each candidate is mapped to a playable Tidal track and persisted to the catalog
5. Recently played tracks and duplicates are filtered out
6. Results are capped per artist for diversity and trimmed to the surface limit
7. New users (no seeds) fall back to Last.fm charts (`chart.getTopTracks`)
8. The final list is cached per surface and returned

### Track Enrichment Flow

When a new track enters the system:

1. A job is queued for track enrichment
2. Last.fm tags and play count are fetched for the track
3. MusicBrainz resolves canonical identifiers and genre
4. Genre is derived (MusicBrainz genre, falling back to the top Last.fm tag)
5. Tags, genre, and identifiers are written to `track_features` and the track is marked enriched

---

## API and Module Behaviour

### REST API Structure

The API follows REST conventions with these main resource groups:

**Users**: `GET /users/:id` resolves external IDs to internal user records. All personalised endpoints require a user ID.

**Recommendations**: `GET /users/:id/recommendations` generates track suggestions with query parameters for surface type, seed track, and limit. `POST /users/:id/queue/init` and `POST /users/:id/queue/update` manage the playback queue.

**Library**: `GET /users/:id/library` returns liked tracks, saved albums, and followed artists. `POST /library` actions add or remove items.

**Playlists**: `GET /playlists/:id` retrieves playlist details. `POST /playlists` creates new playlists. `POST /playlists/:id/tracks` adds tracks.

**Interactions**: `POST /interactions` records play events, likes, and other user actions.

**Browse**: `GET /browse/categories` returns genre and mood categories. `GET /browse/new-releases` and `GET /browse/featured` return curated content.

**Tidal Proxy**: `GET /tidal/tracks/:id/stream` proxies streaming manifests. `GET /tidal/images/*` proxies and caches album artwork.

**Last.fm**: `GET /lastfm/artist/:artistName` returns artist info with Tidal-validated similar artists. `GET /lastfm/tag/:tagName` and `GET /lastfm/tag/:tagName/similar` return tag metadata.

---

## Testing

The project does not currently include an automated test suite. Testing is performed manually through:

1. **API Exploration**: Use the Swagger UI at `/docs` when running the API locally
2. **Homepage Debug Endpoint**: `GET /users/:userId/homepage/debug` returns diagnostic information about shelf generation
3. **Health Checks**: `GET /health` on the API verifies the server is up

To verify recommendations are working:

1. Ensure `LASTFM_API_KEY` is set and the catalog has tracks
2. Generate some play history through the UI
3. Check that the homepage loads with personalised shelves
4. Verify the debug endpoint shows 10 items per shelf and 50 tracks per mix

---

## Deployment Overview

### Production Considerations

1. **Build the Frontend**: Run `npm run build` in the Frontend directory to generate static files
2. **Environment Variables**: Ensure all required variables are set in production
3. **Database**: The SQLite file should be on persistent storage
4. **Process Management**: Use a process manager like PM2, systemd, or Docker to manage the API and worker processes

### Docker Deployment (Example)

While Docker configurations are not included in the repository, a production deployment would typically:

- Containerise the API server with the SQLite volume mounted
- Run the worker process (same image, `npm run worker`) alongside the API
- Containerise the frontend as a static file server or integrate with the API container
- Use a reverse proxy (nginx, traefik) for SSL termination and routing

---

## Performance and Design Considerations

### Caching Strategy

Two levels of caching improve response times:

1. **In-Memory LRU**: User profiles and recommendation results cached with TTL
2. **SQLite**: Database query caching via pragmas (cache_size = 64MB, mmap enabled)

### Database Optimisations

SQLite is configured with WAL mode for concurrent reads during writes, memory-mapped I/O for large reads, and optimised page sizes. Indexes cover all foreign keys and common query patterns.

### Recommendation Latency

Recommendation latency is dominated by outbound Last.fm and Tidal calls. To keep responses fast:

- Results are cached per surface in memory (2 minute TTL)
- Seed expansion fans out across Last.fm endpoints in parallel
- Tidal resolution is batched with a hard cap on lookups per request
- Genre-preference profiles are cached in memory (5 minute TTL)

### Trade-offs

1. **SQLite vs PostgreSQL**: SQLite was chosen for simplicity in single-node deployments. It limits horizontal scaling but eliminates network overhead and configuration complexity.

2. **Last.fm Similarity vs Local Models**: Recommendations rely on Last.fm's crowd-sourced listening data rather than a local ML model. This removes all model/inference infrastructure at the cost of a network dependency and per-request API calls.

3. **Client-Side vs Server-Side Rendering**: Next.js App Router provides server-side rendering for initial loads, improving SEO and first paint, at the cost of server compute.

---

## Known Limitations

1. **Single User Dev Mode**: The current implementation uses a hardcoded development user. Multi-user support requires authentication implementation.

2. **Tidal API Dependency**: Music metadata and streaming require a running Tidal API instance. The application cannot function without this external service.

3. **Last.fm Dependency**: Personalised recommendations require a Last.fm API key and network access. Without it, the system falls back to local database popularity.

4. **No Mobile Application**: Only web interface is provided. No native iOS or Android applications exist.

5. **Catalog Population**: The catalog grows as tracks are ingested and resolved from Last.fm/Tidal; there is no bundled bulk seed script.

6. **No Collaborative Filtering**: Recommendations are content-similarity (Last.fm) and popularity-based. True collaborative filtering across users is not implemented.

---

## Troubleshooting

### Homepage Shows No Content

- Verify the database has tracks: Check API logs for "Dataset row counts at startup"
- Ensure `LASTFM_API_KEY` is set so trending/recommendation fallbacks work
- Verify the Tidal API is reachable (recommendations resolve candidates to Tidal)

### Playback Does Not Start

- Verify the Tidal API is reachable from the backend
- Check browser console for Dash.js errors
- Ensure the track has a valid Tidal ID in the database

### Recommendations Feel Repetitive

- Build up more listening history (likes/saves are stronger seeds than plays)
- Clear recommendation cache by restarting the API server
- Confirm Last.fm is reachable — without it, results fall back to popularity

### Recommendations Are Empty

- Confirm `LASTFM_API_KEY` is valid (the client logs a warning when missing)
- Check that seed tracks have a resolvable artist name in the catalog
- Verify outbound network access to `ws.audioscrobbler.com`

---

## Contribution Guide

### Getting Started

1. Fork the repository and clone your fork
2. Follow the [Installation Guide](#installation-guide) to set up your development environment
3. Create a feature branch: `git checkout -b feature/your-feature-name`

### Code Style

- **TypeScript**: Strict mode enabled. Avoid `any` types.
- **Formatting**: Prettier configuration included. Run `npx prettier --write` before committing.
- **Linting**: ESLint configured for Next.js. Fix all warnings.

### Making Changes

1. **Small, Focused Commits**: Each commit should address one concern
2. **No Breaking Changes**: Maintain backward compatibility for API responses
3. **Add Context**: Update this README if your change affects setup or configuration
4. **Test Manually**: Verify your changes work with a full local stack

### Pull Request Process

1. Push your branch to your fork
2. Open a pull request with a clear description of changes
3. Reference any related issues
4. Respond to review feedback promptly

### Areas for Contribution

- **Authentication System**: Replace hardcoded dev user with proper auth
- **Mobile Responsiveness**: Improve the UI for tablet and mobile viewports
- **Playlist Collaboration**: Allow multiple users to edit playlists
- **Import/Export**: Support importing playlists from external sources or exporting to M3U
- **Keyboard Shortcuts**: Add global keyboard controls for playback
- **Lyrics Integration**: Display synced lyrics from external sources

---

## Roadmap and Future Improvements

Potential enhancements based on current architecture:

1. **Proper Authentication**: OAuth2 or JWT-based user management
2. **WebRTC Audio Streaming**: Reduce dependency on Tidal for audio delivery
3. **Real-Time Features**: WebSocket integration for collaborative listening
4. **Plugin System**: Allow third-party integrations for lyrics, concerts, merchandise
5. **Analytics Dashboard**: Visualise listening patterns and recommendation effectiveness

---

## Community Value

Muse demonstrates a complete, production-quality music streaming implementation that anyone can self-host. It bridges the gap between proprietary streaming services and bare-bones media servers by providing:

- **Smart Discovery**: Last.fm-powered similarity recommendations comparable to commercial platforms
- **Data Ownership**: All listening history and preferences stored locally
- **Educational Value**: Complete source code for learning full-stack TypeScript and music-API integration
- **Hackability**: Clean architecture allows easy extension and customisation

Developers interested in recommendation systems, audio streaming, or modern React patterns will find the codebase informative. Music enthusiasts gain a personalised streaming experience without subscription fees or data collection concerns.
