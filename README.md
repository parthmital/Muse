# Muse

A self-hosted music streaming and discovery platform that combines AI-powered recommendations with high-fidelity audio streaming.

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

The system implements a three-tier architecture:

1. **Embedding Microservice (Python)**: Uses Sentence Transformers to generate 384-dimensional vector embeddings for tracks based on metadata and audio features. FAISS (Facebook AI Similarity Search) provides fast approximate nearest neighbour search for recommendations.

2. **API Layer (Node.js + TypeScript)**: Fastify-based REST API handling user interactions, library management, playlist operations, and recommendation orchestration. SQLite with WAL mode serves as the primary datastore.

3. **Frontend (Next.js + React)**: Server-rendered React application using the App Router pattern. Dash.js handles MPEG-DASH adaptive streaming. TailwindCSS provides the styling system.

The recommendation engine combines collaborative filtering signals (user listening history) with content-based filtering (track embeddings) and popularity-based signals to generate diverse, novel suggestions.

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

- **Hybrid Recommendation System**: Combines embedding similarity, popularity signals, recency decay, and diversity re-ranking
- **Background Job Processing**: SQLite-backed job queue for track enrichment, profile updates, and index rebuilds
- **Multi-Level Caching**: LRU caches for tracks, user profiles, and recommendations with configurable TTL
- **Color Extraction**: Automatic vibrant color extraction from album artwork for UI theming
- **Profile Vector Construction**: Aggregates user listening history into preference vectors for personalised recommendations
- **Diversity Re-ranking**: MMR (Maximal Marginal Relevance) algorithm to balance similarity with variety
- **Nightly Index Rebuilds**: Scheduled FAISS index reconstruction to incorporate new tracks

---

## Tech Stack

### Backend Services

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 20+ |
| Language | TypeScript | 5.4.5 |
| Framework | Fastify | 4.27.0 |
| Database | better-sqlite3 | 12.8.0 |
| Validation | Zod | 3.23.8 |
| Logging | Pino | 9.2.0 |
| Queue | fastq | 1.17.1 |
| Scheduling | node-schedule | 2.1.1 |
| HTTP Client | axios | 1.7.2 |

### Python Microservice

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | FastAPI | 0.135.2 |
| Server | Uvicorn | 0.42.0 |
| Embeddings | sentence-transformers | 2.7.0 |
| ML Framework | PyTorch | 2.3.0 |
| Vector Search | FAISS (CPU/GPU) | Latest |
| Numerical | NumPy | 1.26.4 |

### Frontend

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 16.1.6 |
| UI Library | React | 19.2.3 |
| Styling | TailwindCSS | 4.1.18 |
| Data Fetching | SWR | 2.4.1 |
| Streaming | Dash.js | 4.7.4 |
| Compiler | React Compiler | 1.0.0 |

### External Integrations

- **Tidal API**: Music metadata, album artwork, and streaming URLs
- **Last.fm**: Artist tags, play counts, and scrobbling
- **MusicBrainz**: Canonical artist and release identifiers
- **Spotify Web API**: Audio features (energy, valence, danceability)

---

## System Architecture

Muse follows a microservices pattern with three distinct runtime components that communicate via HTTP.

### Component Interaction

The **Python Embedding Service** runs on port 6000 and exposes endpoints for generating text embeddings and performing similarity search via FAISS. It maintains an in-memory FAISS index that persists to disk. The service automatically detects CUDA availability and uses GPU acceleration when possible.

The **Node.js API Server** runs on port 5000 and serves as the primary backend. It handles all client requests, manages the SQLite database, enqueues background jobs, and proxies requests to the embedding service. On startup, it runs database migrations, validates the Tidal API connection, and ensures a development user exists.

The **Next.js Frontend** runs on port 3000 (development) or serves static files in production. It communicates exclusively with the Node.js API and renders server-side for initial page loads.

### Data Flow

When a user plays a track, the frontend sends an interaction event to the API. The API stores this in the user_interactions table and schedules a profile update job. The worker process picks up the job, recalculates the user's preference vector, and updates their profile. This profile then influences future recommendation requests.

For recommendation generation, the API queries the user's profile vector, requests similar vectors from the embedding service, applies business rules and filtering, then returns the results. The embedding service performs the actual FAISS search and returns track IDs with similarity scores.

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
│   │   │   ├── embeddingClient.ts        # Python service client
│   │   │   ├── hifiClient.ts             # Audio streaming client
│   │   │   ├── homepageBuilder.ts        # Personalised shelf generation
│   │   │   ├── lastfmClient.ts           # Last.fm API client
│   │   │   ├── popularityService.ts      # Track popularity tracking
│   │   │   ├── profileBuilder.ts         # User profile construction
│   │   │   ├── queueManager.ts           # Playback queue logic
│   │   │   └── recommender.ts            # Core recommendation engine
│   │   ├── types/                        # TypeScript type definitions
│   │   ├── workers/                      # Background job processing
│   │   │   ├── runner.ts                 # Job queue poller
│   │   │   └── jobs/                     # Job handlers
│   │   ├── config.ts                     # Environment configuration
│   │   └── index.ts                      # Application entry point
│   ├── python/                           # Embedding microservice
│   │   ├── main.py                       # FastAPI application
│   │   └── requirements.txt              # Python dependencies
│   ├── scripts/                          # Utility scripts
│   │   ├── buildIndex.ts                 # Manual FAISS index rebuild
│   │   └── seedCatalog.ts                # Initial data seeding
│   ├── lastfm_helper/                    # Last.fm data structures
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
- Python 3.10 or later
- A Tidal API instance (local or remote) for music metadata
- Last.fm API key (optional, for artist tags)
- Spotify API credentials (optional, for audio features)

### Step-by-Step Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Muse
   ```

2. **Install Backend Dependencies**

   ```bash
   cd Backend
   npm install
   ```

3. **Install Python Dependencies**

   ```bash
   cd python
   pip install -r requirements.txt
   cd ..
   ```

4. **Configure Environment Variables**

   Create a `.env` file in the `Backend` directory:

   ```env
   NODE_ENV=development
   PORT=5000
   API_BASE_URL=http://localhost:5000
   SQLITE_PATH=./data/music_rec.db
   TIDAL_API_BASE_URL=http://localhost:4000
   EMBEDDING_SERVICE_URL=http://localhost:6000
   LASTFM_API_KEY=your_lastfm_key
   SPOTIFY_CLIENT_ID=your_spotify_id
   SPOTIFY_CLIENT_SECRET=your_spotify_secret
   ```

5. **Install Frontend Dependencies**

   ```bash
   cd ../Frontend
   npm install
   ```

6. **Build the Frontend**

   ```bash
   npm run build
   ```

---

## How to Use

### Starting the Services

You need to run three components simultaneously. Each requires a separate terminal:

**Terminal 1 - Embedding Service:**
```bash
cd Backend/python
uvicorn main:app --host 0.0.0.0 --port 6000
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

1. **Browse Music**: The homepage displays personalised shelves. Click any album or artist card to view details.

2. **Play Music**: Click the play button on any track. The persistent player bar at the bottom shows current playback.

3. **Create Playlists**: Right-click tracks and select "Add to Playlist" or use the library page to create new playlists.

4. **Like Songs**: Click the heart icon in the player or on any track to add it to your liked songs.

5. **Search**: Use the search bar in the top navigation to find tracks, albums, or artists.

6. **Discover**: Visit the discover page for recommendations outside your usual listening patterns.

---

## Developer Guide

### Running Locally

The development setup runs four processes. You can use a process manager like `concurrently` or a terminal multiplexer.

Recommended workflow:

1. Start the embedding service first (it loads the ML model)
2. Start the API server (it runs migrations and validates connections)
3. Start the worker (it begins polling for jobs)
4. Start the frontend (it proxies API requests)

### Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start API with hot reload |
| `npm run worker` | Start job queue processor |
| `npm run seed` | Seed database with initial catalog |
| `npm run build-index` | Rebuild FAISS index manually |
| `npm run build` | Compile TypeScript |

### Code Organisation Principles

- **API Routes**: Each domain has its own route file in `src/api/`. Routes handle HTTP concerns only and delegate to services.
- **Services**: Business logic lives in `src/services/`. Services are pure functions or classes with no HTTP knowledge.
- **Database**: Raw SQL via better-sqlite3. No ORM. Migrations run automatically on startup.
- **Workers**: Jobs are idempotent and can be retried. Each job type has a handler in `src/workers/jobs/`.

---

## Configuration Guide

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `5000` | API server port |
| `API_BASE_URL` | `http://localhost:5000` | Public API URL |
| `SQLITE_PATH` | `./data/music_rec.db` | Database file location |
| `TIDAL_API_BASE_URL` | `http://localhost:4000` | Tidal API endpoint |
| `EMBEDDING_SERVICE_URL` | `http://localhost:6000` | Python service URL |
| `EMBEDDING_DIM` | `384` | Vector dimensions |
| `LOG_LEVEL` | `info` | Pino log level |
| `QUEUE_SIZE` | `25` | Default queue length |
| `HOME_REC_COUNT` | `20` | Recommendations per shelf |
| `MIX_TRACK_COUNT` | `30` | Tracks per generated mix |
| `DIVERSITY_LAMBDA` | `0.3` | MMR diversity parameter |
| `NOVELTY_WEIGHT` | `0.2` | Novel track preference |
| `POPULARITY_WEIGHT` | `0.1` | Popularity influence |
| `RECENCY_DECAY_DAYS` | `30` | History decay period |
| `CACHE_MAX_ITEMS` | `5000` | LRU cache size |
| `CACHE_TRACK_TTL_MS` | `3600000` | Track cache TTL (1 hour) |
| `CACHE_REC_TTL_MS` | `120000` | Recommendation cache TTL (2 minutes) |
| `WORKER_POLL_MS` | `500` | Job polling interval |
| `WORKER_CONCURRENCY` | `4` | Parallel job limit |

---

## Core Workflows

### Track Playback Flow

When a user clicks play on a track:

1. The frontend loads the track's audio manifest from the Tidal API via the backend proxy
2. Dash.js initialises the media player with the manifest URL
3. As audio plays, the frontend periodically sends interaction events to the API
4. The API records play duration, completion ratio, and context in user_interactions
5. If play duration exceeds a threshold, a profile update job is queued
6. The worker recalculates the user's preference vector based on all interactions

### Recommendation Generation Flow

When the homepage loads:

1. The frontend requests personalised shelves from `/users/{id}/homepage`
2. The homepage builder queries the user's profile vector and recent listening history
3. For each shelf type (Daily Mix, Discover, Made For You), a different strategy generates candidates
4. The system requests similar tracks from the embedding service using the profile vector
5. Results are filtered to remove recently played tracks and duplicates
6. Diversity re-ranking applies MMR to balance similarity with variety
7. Popularity and novelty weighting adjusts scores
8. The final track list is returned and rendered as horizontal shelves

### Track Enrichment Flow

When a new track enters the system:

1. A job is queued for track enrichment
2. The worker fetches audio features from Spotify API (energy, valence, danceability, etc.)
3. Last.fm tags are fetched for the artist
4. MusicBrainz IDs are resolved for canonical references
5. An embedding vector is generated from the track's metadata and audio features
6. The embedding is upserted into the FAISS index via the Python service
7. The track is marked as enriched in the database

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

### Embedding Service Endpoints

The Python microservice exposes:

- `POST /embed`: Generate single text embedding
- `POST /embed/batch`: Batch embedding generation
- `POST /search`: FAISS similarity search with optional exclusion list
- `POST /upsert`: Add single vector to index
- `POST /rebuild`: Batch index reconstruction
- `GET /health`: Service status and index statistics

---

## Testing

The project does not currently include an automated test suite. Testing is performed manually through:

1. **API Exploration**: Use the Swagger UI at `/docs` when running the API locally
2. **Homepage Debug Endpoint**: `GET /users/:userId/homepage/debug` returns diagnostic information about shelf generation
3. **Health Checks**: `GET /health` on both API and embedding service verifies component status

To verify recommendations are working:

1. Seed the database with catalog data
2. Generate some play history through the UI
3. Check that the homepage loads with personalised shelves
4. Verify the debug endpoint shows 10 items per shelf and 50 tracks per mix

---

## Deployment Overview

### Production Considerations

1. **Build the Frontend**: Run `npm run build` in the Frontend directory to generate static files
2. **Environment Variables**: Ensure all required variables are set in production
3. **Database**: The SQLite file should be on persistent storage
4. **FAISS Index**: The embedding service persists its index to `./data/faiss/`. Ensure this directory persists across restarts
5. **Process Management**: Use a process manager like PM2, systemd, or Docker to manage the three services

### Docker Deployment (Example)

While Docker configurations are not included in the repository, a production deployment would typically:

- Containerise the embedding service with GPU support if available
- Containerise the API server with the SQLite volume mounted
- Containerise the frontend as a static file server or integrate with the API container
- Use a reverse proxy (nginx, traefik) for SSL termination and routing

---

## Performance and Design Considerations

### Caching Strategy

Three levels of caching improve response times:

1. **In-Memory LRU**: Track metadata, user profiles, and recommendations cached with TTL
2. **SQLite**: Database query caching via pragmas (cache_size = 64MB, mmap enabled)
3. **FAISS Index**: In-memory vector index for sub-millisecond similarity search

### Database Optimisations

SQLite is configured with WAL mode for concurrent reads during writes, memory-mapped I/O for large reads, and optimised page sizes. Indexes cover all foreign keys and common query patterns.

### Recommendation Latency

The recommendation pipeline is designed for sub-200ms response times:

- Profile vectors cached in memory (5 minute TTL)
- FAISS search in Python microservice (GPU accelerated when available)
- Parallel enrichment of candidate tracks
- Incremental updates to the FAISS index (nightly rebuilds for full reindexing)

### Trade-offs

1. **SQLite vs PostgreSQL**: SQLite was chosen for simplicity in single-node deployments. It limits horizontal scaling but eliminates network overhead and configuration complexity.

2. **In-Process FAISS vs External Vector DB**: FAISS runs in the Python service process. This adds memory overhead but eliminates network latency for similarity searches.

3. **Client-Side vs Server-Side Rendering**: Next.js App Router provides server-side rendering for initial loads, improving SEO and first paint, at the cost of server compute.

---

## Known Limitations

1. **Single User Dev Mode**: The current implementation uses a hardcoded development user. Multi-user support requires authentication implementation.

2. **Tidal API Dependency**: Music metadata and streaming require a running Tidal API instance. The application cannot function without this external service.

3. **GPU Optional**: The embedding service falls back to CPU if CUDA is unavailable. Batch embedding and index operations are significantly slower on CPU.

4. **No Mobile Application**: Only web interface is provided. No native iOS or Android applications exist.

5. **Manual Catalog Seeding**: Initial music catalog must be populated via the seed script or manual database insertion.

6. **No Collaborative Filtering**: Recommendations are currently content-based (embeddings) and popularity-based. True collaborative filtering across users is not implemented.

---

## Troubleshooting

### Homepage Shows No Content

- Verify the database has tracks: Check API logs for "Dataset row counts at startup"
- Run the seed script: `npm run seed` in the Backend directory
- Check the embedding service health: `GET http://localhost:6000/health`

### Playback Does Not Start

- Verify the Tidal API is reachable from the backend
- Check browser console for Dash.js errors
- Ensure the track has a valid Tidal ID in the database

### Recommendations Feel Repetitive

- Adjust `DIVERSITY_LAMBDA` environment variable (higher = more diverse)
- Increase `NOVELTY_WEIGHT` to favour less-played tracks
- Clear recommendation cache by restarting the API server

### Embedding Service Errors

- Verify Python dependencies installed: `pip install -r requirements.txt`
- Check CUDA availability if using GPU: The health endpoint reports device type
- Review FAISS index disk space: Index files can grow large with many tracks

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
- **Python**: Black formatter for the embedding service.

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
- **Import/Export**: Support importing playlists from Spotify or exporting to M3U
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

- **AI Discovery**: Vector-based recommendations typically only found in commercial platforms
- **Data Ownership**: All listening history and preferences stored locally
- **Educational Value**: Complete source code for learning full-stack TypeScript and ML integration
- **Hackability**: Clean architecture allows easy extension and customisation

Developers interested in recommendation systems, audio streaming, or modern React patterns will find the codebase informative. Music enthusiasts gain a personalised streaming experience without subscription fees or data collection concerns.
