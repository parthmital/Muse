/**
 * src/services/artistFilters.ts
 *
 * Pure heuristics for distinguishing real artists from compilation /
 * various-artist / genre-pseudo "artists" that pollute the catalog (each
 * compilation album contributes dozens of tracks under one name). Extracted
 * from homepageBuilder so it can be unit-tested without touching the DB.
 */

// Pseudo-"artists" that are really compilations. We never want these anchoring
// an "<Artist> Mix".
export const COMPILATION_MARKERS = [
	"various artists",
	"various artist",
	"greatest hits",
	"hits collective",
	"karaoke",
	"tribute",
	"originally performed",
	"made famous",
	"100 hits",
	"now that's what i call",
	"now thats what i call",
	"compilation",
	"top hits",
	"party hits",
];

export function isCompilationArtist(name: string | null | undefined): boolean {
	if (!name) return true;
	const n = name.toLowerCase().trim();
	if (!n) return true;
	if (COMPILATION_MARKERS.some((m) => n.includes(m))) return true;
	// "Top 40 ...", "Top 100 ..."
	if (/\btop\s*\d+\b/.test(n)) return true;
	// Names starting with a chart marker ("#1 Hits Now").
	if (/^#/.test(n)) return true;
	// A real artist almost never has the standalone word "hits" in their name —
	// it's the hallmark of a compilation ("Acoustic Hits", "90's Rock Hits").
	if (/\bhits\b/.test(n)) return true;
	// Genre/mood pseudo-artists ("Classical New Age Piano Music", "Sleep Music").
	if (
		/\b(piano music|new age|easy listening|lo-?fi|study music|sleep music|meditation|background music|relaxing music)\b/.test(
			n,
		)
	)
		return true;
	return false;
}
