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

	sqlitePath: env("SQLITE_PATH", "./data/music_rec.db"),

	hifiBaseUrl: env("HIFI_API_BASE_URL", ""),
	hifiApiKey: env("HIFI_API_KEY", ""),

	tidalApiBaseUrl: env("TIDAL_API_BASE_URL", "http://localhost:4000"),

	spotifyClientId: env("SPOTIFY_CLIENT_ID", ""),
	spotifyClientSecret: env("SPOTIFY_CLIENT_SECRET", ""),

	lastfmApiKey: env("LASTFM_API_KEY", ""),

	musicbrainzApp: env("MUSICBRAINZ_APP", "MusicRecEngine/1.0"),

	embeddingServiceUrl: env("EMBEDDING_SERVICE_URL", "http://localhost:6000"),
	embeddingDim: num("EMBEDDING_DIM", 384),

	queueSize: num("QUEUE_SIZE", 25),
	homeRecCount: num("HOME_REC_COUNT", 20),
	mixTrackCount: num("MIX_TRACK_COUNT", 30),
	diversityLambda: num("DIVERSITY_LAMBDA", 0.3),
	noveltyWeight: num("NOVELTY_WEIGHT", 0.2),
	popularityWeight: num("POPULARITY_WEIGHT", 0.1),
	recencyDecayDays: num("RECENCY_DECAY_DAYS", 30),

	cacheTrackTtlMs: num("CACHE_TRACK_TTL_MS", 3_600_000),
	cacheProfileTtlMs: num("CACHE_PROFILE_TTL_MS", 300_000),
	cacheRecTtlMs: num("CACHE_REC_TTL_MS", 120_000),
	cacheMaxItems: num("CACHE_MAX_ITEMS", 5000),

	workerPollMs: num("WORKER_POLL_MS", 500),
	workerConcurrency: num("WORKER_CONCURRENCY", 4),
} as const;
