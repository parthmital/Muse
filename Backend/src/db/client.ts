/**
 * src/db/client.ts
 *
 * Database client using raw better-sqlite3 (no ORM).
 * Initializes the SQLite database with performance pragmas
 * and runs inline migrations.
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config.js";
import { setDbInstance, toJson, fromJson } from "./helpers.js";

// Re-export helpers so existing imports keep working
export { toJson, fromJson } from "./helpers.js";

function openDb(): Database {
	mkdirSync(dirname(config.sqlitePath), { recursive: true });

	const sqlite = new Database(config.sqlitePath);

	// ── Performance pragmas ────────────────────────────────────────────────────
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("synchronous = NORMAL");
	sqlite.pragma("cache_size = -65536");
	sqlite.pragma("temp_store = MEMORY");
	sqlite.pragma("mmap_size = 268435456");
	sqlite.pragma("page_size = 4096");
	sqlite.pragma("wal_autocheckpoint = 1000");
	sqlite.pragma("foreign_keys = ON");

	return sqlite;
}

const sqlite = openDb();
setDbInstance(sqlite);

// Export the raw sqlite instance for direct queries
export const db: Database = sqlite;

// ── Migrations ─────────────────────────────────────────────────────────────────
export function runMigrations() {
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			external_id TEXT NOT NULL UNIQUE,
			is_new INTEGER DEFAULT 1,
			created_at INTEGER DEFAULT (unixepoch()),
			updated_at INTEGER DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS artists (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			popularity REAL,
			picture_url TEXT,
			musicbrainz_id TEXT,
			genres TEXT,
			lastfm_tags TEXT,
			raw_api_data TEXT,
			updated_at INTEGER DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS albums (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			cover_url TEXT,
			vibrant_color TEXT,
			release_date TEXT,
			musicbrainz_id TEXT,
			raw_api_data TEXT,
			updated_at INTEGER DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS tracks (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			duration INTEGER,
			bpm REAL,
			key TEXT,
			key_scale TEXT,
			popularity REAL,
			explicit INTEGER DEFAULT 0,
			audio_quality TEXT,
			isrc TEXT,
			mix_ids TEXT,
			raw_api_data TEXT,
			artist_id TEXT REFERENCES artists(id),
			album_id TEXT REFERENCES albums(id),
			created_at INTEGER DEFAULT (unixepoch()),
			updated_at INTEGER DEFAULT (unixepoch())
		);
		CREATE INDEX IF NOT EXISTS tracks_popularity_idx ON tracks(popularity);

		CREATE TABLE IF NOT EXISTS track_features (
			track_id TEXT PRIMARY KEY REFERENCES tracks(id),
			energy REAL,
			valence REAL,
			danceability REAL,
			acousticness REAL,
			instrumentalness REAL,
			loudness REAL,
			speechiness REAL,
			liveness REAL,
			spotify_tempo REAL,
			spotify_id TEXT,
			musicbrainz_id TEXT,
			genre TEXT,
			sub_genre TEXT,
			mood_tags TEXT,
			lastfm_play_count INTEGER,
			embedding TEXT,
			embedding_model TEXT,
			enrichment_status TEXT DEFAULT 'pending',
			enriched_at INTEGER,
			error_message TEXT
		);
		CREATE INDEX IF NOT EXISTS track_features_status_idx ON track_features(enrichment_status);

		CREATE TABLE IF NOT EXISTS user_interactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL REFERENCES users(id),
			track_id TEXT REFERENCES tracks(id),
			artist_id TEXT REFERENCES artists(id),
			album_id TEXT REFERENCES albums(id),
			event_type TEXT NOT NULL,
			play_duration_sec INTEGER,
			track_duration_sec INTEGER,
			completion_ratio REAL,
			session_id TEXT,
			context TEXT,
			occurred_at INTEGER DEFAULT (unixepoch())
		);
		CREATE INDEX IF NOT EXISTS ui_user_idx ON user_interactions(user_id);
		CREATE INDEX IF NOT EXISTS ui_track_idx ON user_interactions(track_id);
		CREATE INDEX IF NOT EXISTS ui_occurred_idx ON user_interactions(occurred_at);
		CREATE INDEX IF NOT EXISTS ui_user_event_time_idx ON user_interactions(user_id, event_type, occurred_at);
		CREATE INDEX IF NOT EXISTS ui_user_artist_idx ON user_interactions(user_id, artist_id);

		CREATE TABLE IF NOT EXISTS user_profiles (
			user_id TEXT PRIMARY KEY REFERENCES users(id),
			profile_vector TEXT,
			avg_energy REAL,
			avg_valence REAL,
			avg_danceability REAL,
			avg_acousticness REAL,
			avg_bpm REAL,
			preferred_genres TEXT,
			total_play_count INTEGER DEFAULT 0,
			unique_tracks_played INTEGER DEFAULT 0,
			updated_at INTEGER DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS session_queues (
			session_id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			queue_json TEXT NOT NULL,
			played_ids TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			updated_at INTEGER DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS jobs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			type TEXT NOT NULL,
			payload TEXT NOT NULL,
			status TEXT DEFAULT 'pending',
			attempts INTEGER DEFAULT 0,
			max_attempts INTEGER DEFAULT 3,
			scheduled_at INTEGER DEFAULT (unixepoch()),
			started_at INTEGER,
			completed_at INTEGER,
			error TEXT
		);
		CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
		CREATE INDEX IF NOT EXISTS jobs_type_idx ON jobs(type);

		CREATE TABLE IF NOT EXISTS recommendations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL REFERENCES users(id),
			surface TEXT NOT NULL,
			tracks_json TEXT NOT NULL,
			generated_at INTEGER DEFAULT (unixepoch()),
			expires_at INTEGER
		);
		CREATE INDEX IF NOT EXISTS rec_user_surface_idx ON recommendations(user_id, surface);

		CREATE TABLE IF NOT EXISTS user_library (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL REFERENCES users(id),
			item_type TEXT NOT NULL,
			item_id TEXT NOT NULL,
			added_at INTEGER DEFAULT (unixepoch()),
			is_pinned INTEGER DEFAULT 0
		);
		CREATE INDEX IF NOT EXISTS user_library_idx ON user_library(user_id, item_type, item_id);
		CREATE UNIQUE INDEX IF NOT EXISTS user_library_unique ON user_library(user_id, item_type, item_id);
		CREATE INDEX IF NOT EXISTS user_library_user_type_idx ON user_library(user_id, item_type);

		CREATE TABLE IF NOT EXISTS playlists (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id),
			title TEXT NOT NULL,
			description TEXT,
			cover_url TEXT,
			created_at INTEGER DEFAULT (unixepoch()),
			updated_at INTEGER DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS playlist_tracks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
			track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
			position INTEGER NOT NULL,
			added_at INTEGER DEFAULT (unixepoch())
		);
		CREATE INDEX IF NOT EXISTS playlist_track_idx ON playlist_tracks(playlist_id, position);
		CREATE INDEX IF NOT EXISTS tracks_album_idx ON tracks(album_id);
		CREATE INDEX IF NOT EXISTS tracks_artist_idx ON tracks(artist_id);
		CREATE INDEX IF NOT EXISTS tf_genre_idx ON track_features(genre);

		CREATE TABLE IF NOT EXISTS search_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL REFERENCES users(id),
			query TEXT,
			item_type TEXT,
			item_id TEXT,
			image_url TEXT,
			metadata TEXT,
			searched_at INTEGER DEFAULT (unixepoch())
		);
		CREATE INDEX IF NOT EXISTS sh_user_time_idx ON search_history(user_id, searched_at);
	`);
}
