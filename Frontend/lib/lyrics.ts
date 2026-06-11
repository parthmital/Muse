/**
 * lib/lyrics.ts
 *
 * Synced + plain lyrics via lrclib.net — a free, key-less, CORS-enabled
 * community lyrics database. Returns time-stamped lines when available so the
 * Now Playing view can highlight the current line, Apple-Music style.
 */

export interface LyricsLine {
	/** Start time in seconds. */
	time: number;
	text: string;
}

export interface LyricsResult {
	synced: LyricsLine[] | null;
	plain: string | null;
}

interface LrclibRecord {
	syncedLyrics?: string | null;
	plainLyrics?: string | null;
}

const LRC_LINE = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

function parseSynced(lrc: string): LyricsLine[] {
	const out: LyricsLine[] = [];
	for (const raw of lrc.split("\n")) {
		LRC_LINE.lastIndex = 0;
		const stamps: number[] = [];
		let match: RegExpExecArray | null;
		let lastIndex = 0;
		while ((match = LRC_LINE.exec(raw)) !== null) {
			const min = parseInt(match[1], 10);
			const sec = parseInt(match[2], 10);
			const frac = match[3] ? parseInt(match[3].padEnd(3, "0"), 10) / 1000 : 0;
			stamps.push(min * 60 + sec + frac);
			lastIndex = LRC_LINE.lastIndex;
		}
		if (!stamps.length) continue;
		const text = raw.slice(lastIndex).trim();
		for (const time of stamps) out.push({ time, text });
	}
	return out.sort((a, b) => a.time - b.time);
}

function toResult(rec: LrclibRecord | null): LyricsResult | null {
	if (!rec) return null;
	const synced = rec.syncedLyrics ? parseSynced(rec.syncedLyrics) : null;
	const plain = rec.plainLyrics?.trim() || null;
	if ((!synced || synced.length === 0) && !plain) return null;
	return { synced: synced && synced.length ? synced : null, plain };
}

export async function fetchLyrics(params: {
	artist: string;
	title: string;
	album?: string;
	durationSec?: number;
	signal?: AbortSignal;
}): Promise<LyricsResult | null> {
	const { artist, title, album, durationSec, signal } = params;
	if (!artist || !title) return null;

	const headers = { Accept: "application/json" };

	// Exact match (best — returns properly aligned synced lyrics).
	const exact = new URLSearchParams({
		artist_name: artist,
		track_name: title,
	});
	if (album) exact.set("album_name", album);
	if (durationSec) exact.set("duration", String(Math.round(durationSec)));

	try {
		const res = await fetch(`https://lrclib.net/api/get?${exact}`, {
			headers,
			signal,
		});
		if (res.ok) {
			const parsed = toResult(await res.json());
			if (parsed) return parsed;
		}
	} catch (err) {
		if ((err as Error)?.name === "AbortError") return null;
	}

	// Fuzzy fallback via search.
	try {
		const search = new URLSearchParams({
			track_name: title,
			artist_name: artist,
		});
		const res = await fetch(`https://lrclib.net/api/search?${search}`, {
			headers,
			signal,
		});
		if (res.ok) {
			const list = (await res.json()) as LrclibRecord[];
			for (const rec of list.slice(0, 3)) {
				const parsed = toResult(rec);
				if (parsed) return parsed;
			}
		}
	} catch {
		// ignore
	}

	return null;
}
