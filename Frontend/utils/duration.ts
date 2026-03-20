import { Song } from "@/components/SongRow";

/**
 * Converts a "M:SS" or "MM:SS" duration string to total seconds.
 */
export function durationToSeconds(duration: string): number {
	const [mins, secs] = duration.split(":").map(Number);
	return mins * 60 + secs;
}

/**
 * Formats a total number of seconds into a human-readable duration string.
 * Returns "X hr Y min" for durations over 60 minutes, or "X min Y sec" otherwise.
 */
export function formatTotalDuration(songs: Song[]): string {
	const totalSeconds = songs.reduce(
		(acc, song) => acc + durationToSeconds(song.duration),
		0,
	);

	const mins = Math.floor(totalSeconds / 60);
	const secs = totalSeconds % 60;

	return mins > 60
		? `${Math.floor(mins / 60)} hr ${mins % 60} min`
		: `${mins} min ${secs} sec`;
}

/**
 * Formats a time value (in seconds) as "M:SS" for the player progress display.
 */
export function formatPlaybackTime(time: number): string {
	if (isNaN(time)) return "0:00";
	const mins = Math.floor(time / 60);
	const secs = Math.floor(time % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}
