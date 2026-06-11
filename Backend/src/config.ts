import "dotenv/config";

function env(key: string, fallback?: string): string {
	const v = process.env[key] ?? fallback;
	if (v === undefined) throw new Error(`Missing env var: ${key}`);
	return v;
}
function num(key: string, fallback: number) {
	return Number(process.env[key] ?? fallback);
}

export const config = {
	nodeEnv: env("NODE_ENV", "development"),
	port: num("PORT", 5000),
	apiBaseUrl: env("API_BASE_URL", "http://localhost:5000"),
	logLevel: env("LOG_LEVEL", "info"),

	// Single-user dev mode: the default identity used by endpoints that don't yet
	// carry an authenticated user. Centralised here so auth can replace it later.
	devUserId: env("DEV_USER_ID", "dev-user-001"),

	sqlitePath: env("SQLITE_PATH", "./data/music_rec.db"),

	hifiBaseUrl: env("HIFI_API_BASE_URL", ""),
	hifiApiKey: env("HIFI_API_KEY", ""),

	tidalApiBaseUrl: env("TIDAL_API_BASE_URL", "http://localhost:4000"),

	lastfmApiKey: env("LASTFM_API_KEY", ""),

	musicbrainzApp: env("MUSICBRAINZ_APP", "MusicRecEngine/1.0"),

	queueSize: num("QUEUE_SIZE", 25),
	homeRecCount: num("HOME_REC_COUNT", 20),
	mixTrackCount: num("MIX_TRACK_COUNT", 30),
	recencyDecayDays: num("RECENCY_DECAY_DAYS", 30),

	cacheProfileTtlMs: num("CACHE_PROFILE_TTL_MS", 300_000),
	cacheRecTtlMs: num("CACHE_REC_TTL_MS", 120_000),

	workerPollMs: num("WORKER_POLL_MS", 500),
	workerConcurrency: num("WORKER_CONCURRENCY", 4),

	// ── Job queue ────────────────────────────────────────────────────────────
	jobMaxAttempts: num("JOB_MAX_ATTEMPTS", 3),
	jobRetryBaseSec: num("JOB_RETRY_BASE_SEC", 60),
	jobLeaseSec: num("JOB_LEASE_SEC", 300),
	jobCleanupIntervalMs: num("JOB_CLEANUP_INTERVAL_MS", 60 * 60 * 1000),
	lastfmCacheGraceDays: num("LASTFM_CACHE_GRACE_DAYS", 30),
	shelfImpressionRetentionDays: num("SHELF_IMPRESSION_RETENTION_DAYS", 90),

	// ── Playback queue ───────────────────────────────────────────────────────
	queueLowWaterMark: num("QUEUE_LOW_WATER_MARK", 5),
	sessionTtlMs: num("SESSION_TTL_MS", 3 * 60 * 60 * 1000),
	playedIdsHistoryCap: num("PLAYED_IDS_HISTORY_CAP", 200),
	highSignalCompletionRatio: num("HIGH_SIGNAL_COMPLETION_RATIO", 0.8),

	// ── Recommender tuning ───────────────────────────────────────────────────
	seedTrackCap: num("SEED_TRACK_CAP", 8),
	seedArtistCap: num("SEED_ARTIST_CAP", 4),
	similarPerTrack: num("SIMILAR_PER_TRACK", 30),
	maxTidalLookups: num("MAX_TIDAL_LOOKUPS", 44),
	tidalResolveBatch: num("TIDAL_RESOLVE_BATCH", 5),
	profileMaxGenres: num("PROFILE_MAX_GENRES", 20),
	profileInteractionLimit: num("PROFILE_INTERACTION_LIMIT", 5000),

	// ── Homepage builder ─────────────────────────────────────────────────────
	sectionItemCount: num("SECTION_ITEM_COUNT", 10),
	collectionTrackCount: num("COLLECTION_TRACK_COUNT", 50),
	homepageFreshSec: num("HOMEPAGE_FRESH_SEC", 6 * 60 * 60),
	trackPoolSize: num("TRACK_POOL_SIZE", 180),
} as const;
