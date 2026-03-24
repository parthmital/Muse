# Muse Refactoring – Implementation Plan

## Architecture Overview

**Current stack:**

- **Backend**: Fastify + Drizzle ORM + better-sqlite3 + LRU caches
- **Frontend**: Next.js 16 + React 19 + SWR + Tailwind CSS 4 + dash.js
- **External**: Tidal-API (Python/FastAPI proxy for TIDAL auth) → Muse Backend → Muse Frontend

**Reference projects:**

- **Monochrome**: Vanilla JS/TS music player (280k+ single-file UI, 65k api.js, 65k player.js) — reference for playback, color extraction, context menus
- **Tidal-API**: Python FastAPI microservice for TIDAL authentication & proxying

---

## Phase 1: Remove ORM – Replace Drizzle with raw better-sqlite3

**Files affected:** `Backend/src/db/client.ts`, `Backend/src/db/schema.ts`, all API routes, services, workers

### 1.1 Create `Backend/src/db/sql.ts` — Raw SQL helper layer

- Remove `drizzle-orm` and `drizzle-kit` dependencies
- Keep `better-sqlite3` (already used underneath)
- Create a typed SQL query builder with prepared statements
- Implement `db.query()`, `db.run()`, `db.get()`, `db.all()` wrappers
- Port all schema definitions to a `migrations.ts` that runs `CREATE TABLE IF NOT EXISTS` statements
- Keep the existing SQLite pragma tuning from `client.ts`

### 1.2 Port all route files to use raw SQL

- `api/interactions.ts` – 3 queries → raw prepared statements
- `api/recommendations.ts` – 2 queries → raw prepared statements
- `api/tracks.ts` – 5 queries → raw prepared statements
- `api/users.ts` – basic user CRUD → raw SQL
- `api/library.ts` – 7 queries → raw prepared statements
- `api/browse.ts` – 3 queries → raw prepared statements
- `api/contextMenu.ts` – 2 queries → raw prepared statements
- `api/actions.ts` – 4 queries → raw prepared statements

### 1.3 Port services to use raw SQL

- `services/recommender.ts` – ~10 Drizzle queries → raw SQL
- `services/profileBuilder.ts` – profile vector queries → raw SQL
- `services/queueManager.ts` – session queue CRUD → raw SQL
- `workers/runner.ts` & `workers/jobs/*` – enrichment queries → raw SQL

### 1.4 Cleanup

- Remove `drizzle-orm`, `drizzle-kit`, `@types/better-sqlite3` (keep `better-sqlite3`)
- Remove `drizzle.config.ts` and `drizzle/` migration folder
- Remove `Backend/src/db/schema.ts` (replaced by migrations.ts inline DDL)

---

## Phase 2: Shift Logic from Frontend to Backend

### 2.1 Move home page data assembly to backend

**New endpoint:** `GET /browse/home`

- Backend assembles all home page shelves (trending, new albums, popular artists) in ONE request
- Currently frontend makes 3 separate search API calls in `page.tsx`
- Backend returns pre-normalized, adapter-ready data

### 2.2 Move library filtering/sorting to backend

**Enhanced endpoint:** `GET /library?filter=albums&sort=recent&q=search`

- Currently `useLibraryManager.ts` fetches raw library + does client-side filtering
- Backend should return enriched, paginated, sorted library items with metadata

### 2.3 Move playlist track checking to backend

- Currently `usePlaylistManager.ts` does a regex check (`RegExp(songKey).test(JSON.stringify(tracksData))` — yikes)
- Backend should have `GET /playlists/:id/contains?trackIds=1,2,3`

### 2.4 Centralize all API_BASE references

- Frontend has hardcoded `"http://localhost:8000"` in multiple hooks
- Consolidate all to use `lib/api.ts`'s `apiFetch` helper

---

## Phase 3: Integrate Custom Recommendations Engine with Frontend

### 3.1 Add `GET /browse/home` with recommendation surfaces

- Use the existing `recommender.ts` engine to power home page sections
- Surface types: `home`, `discover`, `daily_mix`, `radio`
- For new users (no interaction history), fall back to TIDAL trending search

### 3.2 Wire frontend to use `useRecommendations` hook

- Replace the current `page.tsx` 3x search calls with a single `/browse/home` call
- Add `useSWR` hook for home data with stale-while-revalidate

### 3.3 Add "For You" and "Daily Mix" shelves

- Recommendations powered by user profile (interaction history → profile builder → recommender)
- Backend: generate personalized track lists via MMR diversification
- Frontend: new shelf components with generated mix titles

---

## Phase 4: Fix Color Extraction and Application

### 4.1 Backend color extraction fixes

- **Problem**: `getVibrantColorManual()` in `api/tidal.ts` has duplicate code (lines 248-303 AND 461-557)
- **Fix**: Deduplicate — single `extractColor(buffer)` function
- **Problem**: Color extraction is too aggressive (strict HSL filters miss many album arts)
- **Fix**: Use `node-vibrant` (already in deps) as primary, with manual fallback

### 4.2 Fix color cache key inconsistency

- Image proxy creates cache key with `actualSize`, but color endpoint creates key with `requestedSize`
- Normalize cache keys: always use `${pictureId}:${type}` (size shouldn't matter for color)

### 4.3 Frontend color application fixes

- `useColorExtraction.ts` calls backend `/tidal/images/:id/color` which works
- **Problem**: `MediaCard.tsx` applies color to song count number (not useful)
- **Fix**: Apply extracted color to card accent areas (gradient overlays, hover states)
- **Problem**: Color not extracted for player gradient background
- **Fix**: Wire `PlayerContext` to extract color on track change, apply to `Player.tsx`

---

## Phase 5: Fix Music Playback System

### 5.1 Fix DASH playback

- `PlayerContext.tsx` line 80: `dashPlayer.initialize(audio, blobUrl, true)` — auto-play parameter
- **Problem**: DASH player may not attach to audio element correctly after reset
- **Fix**: Check if dash player is already initialized before calling `initialize()`; properly destroy between tracks

### 5.2 Fix BTS (base64 + JSON) stream URL extraction

- Current code (line 721-728) correctly decodes BTS manifests
- **Problem**: No fallback when `info.streamUrl` is null and manifest is present but not BTS
- **Fix**: Add DASH XML manifest parsing (extract `<BaseURL>` element)

### 5.3 Fix dummy audio fallback

- Line 93: `audio.src = "/music/Damocles.m4a"` — hardcoded dummy file
- **Fix**: Show "unable to play" state instead of loading a missing file

### 5.4 Add Previous/Next/Shuffle/Repeat functionality

- `Player.tsx` has buttons but no handlers for Prev, Next, Shuffle, Repeat
- Wire these to `PlayerContext` (skipToNext already exists internally)
- Expose `skipToPrev`, `toggleShuffle`, `toggleRepeat` from context

### 5.5 Fix audio quality reporting

- Backend sends `audioQuality` from stream info
- Frontend `PlayerContext` stores it but doesn't display it prominently

---

## Phase 6: Fix Context Menu Issues

### 6.1 Fix DynamicActionMenu using hardcoded URL

- `DynamicActionMenu.tsx` line 58-60: `fetch("http://localhost:8000/tidal/tracks/...")`
- **Fix**: Use `lib/api.ts` functions instead

### 6.2 Fix PlaylistSelectDialog using hardcoded URL

- `DynamicActionMenu.tsx` line 189: `fetch("http://localhost:8000/playlists/...")`
- **Fix**: Use centralized API functions

### 6.3 Fix context menu rendering issues

- Menu should close on action execution
- Menu should position correctly relative to viewport (currently may overflow)
- Right-click context menus on SongRow need to work (currently only trigger button works)

### 6.4 Fix resolveUser duplication

- `resolveUser()` is copy-pasted in `contextMenu.ts`, `actions.ts`, `recommendations.ts`
- **Fix**: Extract to shared utility function

---

## Phase 7: Normalize Tags, Genres, and Descriptions

### 7.1 Backend normalization

- `browse.ts` genres list has inconsistent casing: `"workout"` vs `"Pop"`, `"Hip-Hop"`
- **Fix**: Normalize all genres to Title Case
- Tags from LastFM/MusicBrainz may contain duplicates or low-quality data
- **Fix**: Add normalization pipeline in enrichment worker

### 7.2 Frontend display normalization

- Album types (EP, SINGLE, COMPILATION) should display consistently
- Track versions ("Deluxe", "Remastered") should be formatted correctly

---

## Phase 8: Fix Playlist Image Handling

### 8.1 Backend playlist image generation

- `playlists` table has `coverUrl` column but it's never populated
- **Fix**: When creating/updating playlists, generate a mosaic from first 4 track covers
- Or: Use first track's album cover as playlist cover

### 8.2 Frontend playlist image display

- Playlist pages should show cover image
- Library view should show playlist covers

---

## Phase 9: Implement Lazy Loading

### 9.1 Image lazy loading

- `FallbackImage.tsx` should use `loading="lazy"` and `IntersectionObserver`
- Currently images load eagerly via Next.js `<Image>` component
- Add blur placeholder data URLs for progressive loading

### 9.2 Route-level code splitting

- Already handled by Next.js app router (each page is a separate chunk)
- Ensure `dashjs` is only loaded when needed (already dynamic import ✓)

### 9.3 SWR data lazy loading

- Add `suspense: false` and `revalidateOnFocus: false` for non-critical data
- Only fetch library/playlist data when user navigates to library page

---

## Phase 10: Add Infinite Scroll with Virtualization

### 10.1 Create `VirtualList` component

- Use native `IntersectionObserver` for scroll detection
- Implement windowing: only render visible items + buffer
- Track item heights for smooth scrolling

### 10.2 Apply to song lists

- Album page: virtualize track list for large albums (100+ tracks)
- Playlist page: virtualize track list
- Search results: infinite scroll with offset-based pagination

### 10.3 Apply to media grids

- Library page: virtualize grid for users with large libraries
- Search results grid: infinite scroll loading

### 10.4 Backend pagination support

- All list endpoints already support `limit` and `offset`
- Add `cursor`-based pagination for search history
- Return `hasMore` flag in responses

---

## Phase 11: Replace Loaders with Skeleton Components

### 11.1 Current skeleton inventory (already exists in `Skeletons.tsx`):

- `TopBarSkeleton` ✓
- `SidebarSkeleton` ✓
- `SearchInputSkeleton` ✓
- `MediaCardSkeleton` ✓
- `MediaGridSkeleton` ✓
- `FilterBarSkeleton` ✓
- `LibrarySkeleton` ✓
- `SearchSkeleton` ✓

### 11.2 Missing skeletons to add:

- `SongRowSkeleton` — match exact grid layout of SongRow
- `SongListSkeleton` — header + N rows
- `PlayerSkeleton` — match player bar layout
- `ArtistPageSkeleton` — banner + tabs + track list
- `AlbumPageSkeleton` — header + track list
- `PlaylistPageSkeleton` — header + track list
- `HomePageSkeleton` — multiple shelf skeletons
- `MediaShelfSkeleton` — title + horizontal card row

### 11.3 Replace generic loaders

- `page.tsx` line 78-80: `"Loading recommendations..."` → `<HomePageSkeleton />`
- All pages with `isLoading` states → use Suspense boundaries or skeleton wrappers
- Ensure skeletons match actual component dimensions pixel-perfectly

---

## Deduplication & Cleanup Targets

### Code duplication to eliminate:

1. `resolveUser()` — 3 copies across API routes → single utility
2. `tryAllSizes()` — duplicated between image proxy and color extraction routes → extract
3. `fetchImage()`/`fetchBuffer()` — duplicated HTTP fetching logic → extract
4. `normalizeId()` format headers/slugs — backend and frontend have separate implementations
5. `API_BASE` — defined in `lib/api.ts`, `utils/images.ts`, `useContextMenu.ts`, `useLibraryManager.ts`, `usePlaylistManager.ts` → single constant
6. SWR `fetcher` function — defined 3 times in different hooks → single export

### Files to consolidate:

1. `utils/colorTheme.ts` — essentially empty, merge into `utils/images.ts`
2. `components/ui/Skeleton.tsx` + `components/ui/Skeletons.tsx` — merge into single file
3. `hooks/useSongActions.ts` — partially overlaps with `useContextMenu.ts` → merge

### Dependencies to remove:

- `drizzle-orm`, `drizzle-kit` (Phase 1)
- `fast-average-color` from frontend (color extraction is now backend-only)
- `postcss` + `prettier-plugin-tailwindcss` may be unnecessary if not used

---

## Execution Order

1. **Phase 6.4 + Phase 2.4** (Dedup resolveUser + centralize API_BASE) — Quick wins
2. **Phase 1** (Remove ORM) — Backend foundation
3. **Phase 4** (Color extraction) — Backend fix
4. **Phase 5** (Playback) — Core functionality
5. **Phase 6** (Context menus) — UX fix
6. **Phase 2** (Shift logic to backend) — Architecture improvement
7. **Phase 3** (Recommendations integration) — Feature completion
8. **Phase 7** (Normalize tags) — Data quality
9. **Phase 8** (Playlist images) — Visual fix
10. **Phase 11** (Skeletons) — UX polish
11. **Phase 9** (Lazy loading) — Performance
12. **Phase 10** (Infinite scroll) — Performance + UX
