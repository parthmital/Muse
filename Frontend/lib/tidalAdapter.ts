/**
 * lib/tidalAdapter.ts
 *
 * Converts Tidal API response types to existing Muse frontend
 * component interfaces (Song, MediaItem) so we can reuse all
 * existing UI components without modification.
 */

import type { Song } from "@/components/SongRow";
import type { MediaItem, MediaType } from "@/components/MediaCard";
import type { TidalTrack, TidalAlbum, TidalArtist } from "@/lib/api";

/**
 * Convert seconds to "M:SS" format used by the existing Song interface.
 */
function formatDuration(seconds: number | undefined): string {
	if (!seconds) return "0:00";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Convert a TidalTrack to the existing Song interface.
 */
export function tidalTrackToSong(track: TidalTrack): Song {
	return {
		title: track.title,
		artist: track.artist?.name ?? track.artists?.[0]?.name ?? "Unknown Artist",
		album: track.album?.title ?? "",
		duration: formatDuration(track.duration),
		img: track.videoCover ?? track.album?.cover ?? "",
		liked: false,
		// Extended fields for Tidal integration
		tidalId: track.id,
		tidalArtistId: track.artist?.id ?? track.artists?.[0]?.id,
		tidalAlbumId: track.album?.id,
		streamUrl: undefined,
		imageId: track.imageId,
		videoCover: track.videoCover || undefined,
	};
}

/**
 * Convert a TidalAlbum to MediaItem.
 */
export function tidalAlbumToMediaItem(album: TidalAlbum): MediaItem {
	return {
		type: "album" as MediaType,
		title: album.title,
		artist: album.artist?.name ?? album.artists?.[0]?.name,
		songs: album.numberOfTracks,
		tidalId: album.id,
		imageUrl: album.cover ?? undefined,
	};
}

/**
 * Convert a TidalArtist to MediaItem.
 */
export function tidalArtistToMediaItem(artist: TidalArtist): MediaItem {
	return {
		type: "artist" as MediaType,
		title: artist.name,
		tidalId: artist.id,
		imageUrl: artist.picture ?? undefined,
	};
}

/**
 * Convert a TidalTrack to MediaItem (for recommendation shelves).
 */
export function tidalTrackToMediaItem(track: TidalTrack): MediaItem {
	return {
		type: "album" as MediaType,
		title: track.album?.title ?? track.title,
		artist: track.artist?.name ?? track.artists?.[0]?.name,
		tidalId: track.album?.id ?? track.id,
		imageUrl: track.album?.cover ?? undefined,
	};
}
