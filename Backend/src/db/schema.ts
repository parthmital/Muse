import {
	sqliteTable,
	text,
	integer,
	real,
	index,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── Helpers ───────────────────────────────────────────────────────────────────
const now = () => sql`(unixepoch())`; // stored as unix seconds
const jsonCol = (name: string) => text(name); // JSON encoded arrays/objects

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
	id: text("id").primaryKey(), // internal UUID
	externalId: text("external_id").notNull().unique(),
	isNew: integer("is_new", { mode: "boolean" }).default(true),
	createdAt: integer("created_at").default(now() as any),
	updatedAt: integer("updated_at").default(now() as any),
});

// ── Artists ───────────────────────────────────────────────────────────────────
export const artists = sqliteTable("artists", {
	id: text("id").primaryKey(), // hifi-api artist id
	name: text("name").notNull(),
	popularity: real("popularity"),
	pictureUrl: text("picture_url"),
	musicbrainzId: text("musicbrainz_id"),
	genres: jsonCol("genres"), // string[]
	lastfmTags: jsonCol("lastfm_tags"), // string[]
	rawApiData: jsonCol("raw_api_data"),
	updatedAt: integer("updated_at").default(now() as any),
});

// ── Albums ────────────────────────────────────────────────────────────────────
export const albums = sqliteTable("albums", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	coverUrl: text("cover_url"),
	vibrantColor: text("vibrant_color"),
	releaseDate: text("release_date"),
	musicbrainzId: text("musicbrainz_id"),
	rawApiData: jsonCol("raw_api_data"),
	updatedAt: integer("updated_at").default(now() as any),
});

// ── Tracks ────────────────────────────────────────────────────────────────────
export const tracks = sqliteTable(
	"tracks",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		duration: integer("duration"),
		bpm: real("bpm"),
		key: text("key"),
		keyScale: text("key_scale"),
		popularity: real("popularity"),
		explicit: integer("explicit", { mode: "boolean" }).default(false),
		audioQuality: text("audio_quality"),
		isrc: text("isrc"),
		mixIds: jsonCol("mix_ids"),
		rawApiData: jsonCol("raw_api_data"),
		artistId: text("artist_id").references(() => artists.id),
		albumId: text("album_id").references(() => albums.id),
		createdAt: integer("created_at").default(now() as any),
		updatedAt: integer("updated_at").default(now() as any),
	},
	(t) => ({
		popularityIdx: index("tracks_popularity_idx").on(t.popularity),
	}),
);

// ── Track Features ────────────────────────────────────────────────────────────
export const trackFeatures = sqliteTable(
	"track_features",
	{
		trackId: text("track_id")
			.primaryKey()
			.references(() => tracks.id),
		// Spotify
		energy: real("energy"),
		valence: real("valence"),
		danceability: real("danceability"),
		acousticness: real("acousticness"),
		instrumentalness: real("instrumentalness"),
		loudness: real("loudness"),
		speechiness: real("speechiness"),
		liveness: real("liveness"),
		spotifyTempo: real("spotify_tempo"),
		spotifyId: text("spotify_id"),
		// MusicBrainz
		musicbrainzId: text("musicbrainz_id"),
		genre: text("genre"),
		subGenre: text("sub_genre"),
		// LastFM
		moodTags: jsonCol("mood_tags"), // string[]
		lastfmPlayCount: integer("lastfm_play_count"),
		// Embedding (384-dim, stored as JSON float array)
		embedding: jsonCol("embedding"),
		embeddingModel: text("embedding_model"),
		// Pipeline
		enrichmentStatus: text("enrichment_status").default("pending"),
		enrichedAt: integer("enriched_at"),
		errorMessage: text("error_message"),
	},
	(t) => ({
		statusIdx: index("track_features_status_idx").on(t.enrichmentStatus),
	}),
);

// ── User Interactions ─────────────────────────────────────────────────────────
export const userInteractions = sqliteTable(
	"user_interactions",
	{
		id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		trackId: text("track_id").references(() => tracks.id),
		artistId: text("artist_id").references(() => artists.id),
		albumId: text("album_id").references(() => albums.id),
		eventType: text("event_type").notNull(),
		playDurationSec: integer("play_duration_sec"),
		trackDurationSec: integer("track_duration_sec"),
		completionRatio: real("completion_ratio"),
		sessionId: text("session_id"),
		context: jsonCol("context"),
		occurredAt: integer("occurred_at").default(now() as any),
	},
	(t) => ({
		userIdx: index("ui_user_idx").on(t.userId),
		trackIdx: index("ui_track_idx").on(t.trackId),
		timeIdx: index("ui_occurred_idx").on(t.occurredAt),
	}),
);

// ── User Profiles ─────────────────────────────────────────────────────────────
export const userProfiles = sqliteTable("user_profiles", {
	userId: text("user_id")
		.primaryKey()
		.references(() => users.id),
	profileVector: jsonCol("profile_vector"), // number[]
	avgEnergy: real("avg_energy"),
	avgValence: real("avg_valence"),
	avgDanceability: real("avg_danceability"),
	avgAcousticness: real("avg_acousticness"),
	avgBpm: real("avg_bpm"),
	preferredGenres: jsonCol("preferred_genres"), // { [genre]: weight }
	totalPlayCount: integer("total_play_count").default(0),
	uniqueTracksPlayed: integer("unique_tracks_played").default(0),
	updatedAt: integer("updated_at").default(now() as any),
});

// ── Session Queues (in-process cache backed by SQLite for recovery) ────────────
export const sessionQueues = sqliteTable("session_queues", {
	sessionId: text("session_id").primaryKey(),
	userId: text("user_id").notNull(),
	queueJson: jsonCol("queue_json").notNull(), // RecommendedTrack[]
	playedIds: jsonCol("played_ids").notNull(), // string[]
	expiresAt: integer("expires_at").notNull(),
	updatedAt: integer("updated_at").default(now() as any),
});

// ── Job Queue ─────────────────────────────────────────────────────────────────
export const jobs = sqliteTable(
	"jobs",
	{
		id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
		type: text("type").notNull(), // enrich_track | update_profile | rebuild_index
		payload: jsonCol("payload").notNull(),
		status: text("status").default("pending"), // pending | running | done | failed
		attempts: integer("attempts").default(0),
		maxAttempts: integer("max_attempts").default(3),
		scheduledAt: integer("scheduled_at").default(now() as any),
		startedAt: integer("started_at"),
		completedAt: integer("completed_at"),
		error: text("error"),
	},
	(t) => ({
		statusIdx: index("jobs_status_idx").on(t.status),
		typeIdx: index("jobs_type_idx").on(t.type),
	}),
);

// ── Recommendation Cache ──────────────────────────────────────────────────────
export const recommendations = sqliteTable(
	"recommendations",
	{
		id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		surface: text("surface").notNull(),
		tracksJson: jsonCol("tracks_json").notNull(),
		generatedAt: integer("generated_at").default(now() as any),
		expiresAt: integer("expires_at"),
	},
	(t) => ({
		userSurfaceIdx: index("rec_user_surface_idx").on(t.userId, t.surface),
	}),
);

// ── User Library ──────────────────────────────────────────────────────────────
export const userLibrary = sqliteTable(
	"user_library",
	{
		id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		itemType: text("item_type").notNull(), // 'track', 'album', 'artist', 'playlist'
		itemId: text("item_id").notNull(), // id of the track/album/artist/playlist
		addedAt: integer("added_at").default(now() as any),
		isPinned: integer("is_pinned", { mode: "boolean" }).default(false),
	},
	(t) => ({
		userLibraryIdx: index("user_library_idx").on(
			t.userId,
			t.itemType,
			t.itemId,
		),
		userLibraryUnique: uniqueIndex("user_library_unique").on(
			t.userId,
			t.itemType,
			t.itemId,
		),
	}),
);

// ── Playlists ─────────────────────────────────────────────────────────────────
export const playlists = sqliteTable("playlists", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id),
	title: text("title").notNull(),
	description: text("description"),
	coverUrl: text("cover_url"),
	createdAt: integer("created_at").default(now() as any),
	updatedAt: integer("updated_at").default(now() as any),
});

export const playlistTracks = sqliteTable(
	"playlist_tracks",
	{
		id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
		playlistId: text("playlist_id")
			.notNull()
			.references(() => playlists.id, { onDelete: "cascade" }),
		trackId: text("track_id")
			.notNull()
			.references(() => tracks.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		addedAt: integer("added_at").default(now() as any),
	},
	(t) => ({
		playlistTrackIdx: index("playlist_track_idx").on(t.playlistId, t.position),
	}),
);

// ── Search History ────────────────────────────────────────────────────────────
export const searchHistory = sqliteTable(
	"search_history",
	{
		id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		query: text("query"),
		itemType: text("item_type"), // artist, album, track, playlist
		itemId: text("item_id"),
		imageUrl: text("image_url"),
		metadata: jsonCol("metadata"), // title, artist name, etc for fast display
		searchedAt: integer("searched_at").default(now() as any),
	},
	(t) => ({
		userTimeIdx: index("sh_user_time_idx").on(t.userId, t.searchedAt),
	}),
);
