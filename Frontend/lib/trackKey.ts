/**
 * lib/trackKey.ts
 *
 * Stable identity for a song used as the key for like/library state and for the
 * itemId persisted to the backend. Prefer the Tidal id (a stable, resolvable
 * identifier) so liked songs can later be re-fetched with full metadata; fall
 * back to "title-artist" only for songs that have no Tidal id.
 */
export function trackKey(song: {
	tidalId?: number | string;
	title: string;
	artist: string;
}): string {
	if (
		song.tidalId !== undefined &&
		song.tidalId !== null &&
		String(song.tidalId).length > 0
	) {
		return String(song.tidalId);
	}
	return `${song.title}-${song.artist}`;
}

/** True if a key looks like a numeric Tidal id (resolvable via the API). */
export function isResolvableTrackKey(key: string): boolean {
	return /^\d+$/.test(key);
}
