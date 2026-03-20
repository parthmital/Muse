# Music Recommendation Engine v3

## Stack

| Concern       | Technology                                        |
| ------------- | ------------------------------------------------- |
| API           | Fastify (TypeScript)                              |
| ORM           | Drizzle + better-sqlite3                          |
| Database      | SQLite (WAL mode)                                 |
| Caching       | In-process LRU (lru-cache)                        |
| Job queue     | SQLite-backed (no Redis)                          |
| Scheduling    | node-schedule                                     |
| Embeddings    | Python · sentence-transformers · all-MiniLM-L6-v2 |
| Vector search | Python · FAISS (GPU if available, CPU fallback)   |
| External APIs | Spotify · LastFM · MusicBrainz · hifi-api         |

## Setup

### 1. TypeScript API

```bash
cp .env.example .env   # fill in API keys
npm install
npm run migrate        # push schema to SQLite
npm run dev            # API on :8000
```

In a second terminal:

```bash
npm run worker         # SQLite job queue worker
```

### 2. Python embedding service

```bash
cd python

# GPU (CUDA):
pip install faiss-gpu torch sentence-transformers fastapi uvicorn numpy pydantic

# CPU only:
pip install faiss-cpu torch sentence-transformers fastapi uvicorn numpy pydantic

uvicorn main:app --host 0.0.0.0 --port 8001
```

The service auto-detects CUDA at startup. `/health` reports `device` and `gpu_faiss`.

### 3. Seed catalogue + build index

```bash
npm run seed -- --limit 10000   # ingest tracks, schedule enrichment
# wait for workers to enrich...
npm run build-index              # rebuild FAISS from DB embeddings
```

## Running both processes

```bash
# Terminal 1 – API
npm run dev

# Terminal 2 – Worker
npm run worker

# Terminal 3 – Embedding service
cd python && uvicorn main:app --port 8001
```

## SQLite performance settings

Applied automatically in `src/db/client.ts`:

| Pragma       | Value     | Effect                    |
| ------------ | --------- | ------------------------- |
| journal_mode | WAL       | Concurrent reads + writes |
| synchronous  | NORMAL    | Safe + fast               |
| cache_size   | -65536    | 64 MB page cache          |
| temp_store   | MEMORY    | Temp tables in RAM        |
| mmap_size    | 268435456 | 256 MB memory-mapped I/O  |

## API

| Method | Path                       | Description                 |
| ------ | -------------------------- | --------------------------- |
| POST   | /tracks/ingest             | Ingest tracks from hifi-api |
| GET    | /tracks/:id                | Get track + features        |
| POST   | /tracks/:id/enrich         | Re-trigger enrichment       |
| POST   | /users/:id/interactions    | Log interaction event       |
| GET    | /users/:id/recommendations | Get recommendations         |
| POST   | /users/:id/queue/init      | Start a playback queue      |
| POST   | /users/:id/queue/update    | Advance queue + refill      |
| GET    | /users/:id/queue           | Get current queue           |
| GET    | /users/:id/profile         | Get user taste profile      |
| POST   | /users/:id/profile/rebuild | Force profile rebuild       |
| GET    | /health                    | Service + embedding health  |
| GET    | /docs                      | Swagger UI                  |
