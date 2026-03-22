CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`cover_url` text,
	`vibrant_color` text,
	`release_date` text,
	`musicbrainz_id` text,
	`raw_api_data` text,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `artists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`popularity` real,
	`picture_url` text,
	`musicbrainz_id` text,
	`genres` text,
	`lastfm_tags` text,
	`raw_api_data` text,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending',
	`attempts` integer DEFAULT 0,
	`max_attempts` integer DEFAULT 3,
	`scheduled_at` integer DEFAULT (unixepoch()),
	`started_at` integer,
	`completed_at` integer,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `playlist_tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` text NOT NULL,
	`track_id` text NOT NULL,
	`position` integer NOT NULL,
	`added_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_url` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`surface` text NOT NULL,
	`tracks_json` text NOT NULL,
	`generated_at` integer DEFAULT (unixepoch()),
	`expires_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_queues` (
	`session_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`queue_json` text NOT NULL,
	`played_ids` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `track_features` (
	`track_id` text PRIMARY KEY NOT NULL,
	`energy` real,
	`valence` real,
	`danceability` real,
	`acousticness` real,
	`instrumentalness` real,
	`loudness` real,
	`speechiness` real,
	`liveness` real,
	`spotify_tempo` real,
	`spotify_id` text,
	`musicbrainz_id` text,
	`genre` text,
	`sub_genre` text,
	`mood_tags` text,
	`lastfm_play_count` integer,
	`embedding` text,
	`embedding_model` text,
	`enrichment_status` text DEFAULT 'pending',
	`enriched_at` integer,
	`error_message` text,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`duration` integer,
	`bpm` real,
	`key` text,
	`key_scale` text,
	`popularity` real,
	`explicit` integer DEFAULT false,
	`audio_quality` text,
	`isrc` text,
	`mix_ids` text,
	`raw_api_data` text,
	`artist_id` text,
	`album_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_interactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`track_id` text,
	`artist_id` text,
	`album_id` text,
	`event_type` text NOT NULL,
	`play_duration_sec` integer,
	`track_duration_sec` integer,
	`completion_ratio` real,
	`session_id` text,
	`context` text,
	`occurred_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_library` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`added_at` integer DEFAULT (unixepoch()),
	`is_pinned` integer DEFAULT false,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`profile_vector` text,
	`avg_energy` real,
	`avg_valence` real,
	`avg_danceability` real,
	`avg_acousticness` real,
	`avg_bpm` real,
	`preferred_genres` text,
	`total_play_count` integer DEFAULT 0,
	`unique_tracks_played` integer DEFAULT 0,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text NOT NULL,
	`is_new` integer DEFAULT true,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_type_idx` ON `jobs` (`type`);--> statement-breakpoint
CREATE INDEX `playlist_track_idx` ON `playlist_tracks` (`playlist_id`,`position`);--> statement-breakpoint
CREATE INDEX `rec_user_surface_idx` ON `recommendations` (`user_id`,`surface`);--> statement-breakpoint
CREATE INDEX `track_features_status_idx` ON `track_features` (`enrichment_status`);--> statement-breakpoint
CREATE INDEX `tracks_popularity_idx` ON `tracks` (`popularity`);--> statement-breakpoint
CREATE INDEX `ui_user_idx` ON `user_interactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `ui_track_idx` ON `user_interactions` (`track_id`);--> statement-breakpoint
CREATE INDEX `ui_occurred_idx` ON `user_interactions` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `user_library_idx` ON `user_library` (`user_id`,`item_type`,`item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_library_unique` ON `user_library` (`user_id`,`item_type`,`item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_external_id_unique` ON `users` (`external_id`);