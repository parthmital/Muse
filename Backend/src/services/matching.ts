/**
 * src/services/matching.ts
 *
 * Pure, dependency-free text-matching used to resolve Last.fm entities (which
 * only carry a name + artist name) to Tidal entities. Kept side-effect-free so
 * it is trivially unit-testable and reusable across track/artist/album resolvers.
 *
 * Why not just Jaccard word-overlap (the old approach)?
 *   - "Love" vs "Love Story" scored 0.5 (one word in two) — a false near-match.
 *   - "Bohemian Rhapsody" vs "Bohemian Rhapsody (Remastered 2011)" scored low
 *     even though they are the same recording for our purposes.
 *   - "Shape of You" silently matched "Shape of You (Remix)".
 * Edit-distance ratio fixes the first; treating reissue noise as ignorable and
 * real version tags as meaningful fixes the other two.
 */

// Version keywords that change *which recording* this is — a mismatch here is a
// real difference (we don't want a live cut when the studio track was asked for).
const MEANINGFUL_VARIANTS = [
	"live",
	"remix",
	"acoustic",
	"instrumental",
	"demo",
	"karaoke",
	"cover",
	"unplugged",
	"reprise",
	"extended",
	"sped up",
	"spedup",
	"slowed",
	"radio edit",
];

// Reissue/packaging noise that does NOT change the recording — strip and ignore
// so a plain Last.fm title still matches a remastered/deluxe Tidal release.
const IGNORABLE_TAGS = [
	"remaster",
	"remastered",
	"deluxe",
	"deluxe edition",
	"expanded",
	"expanded edition",
	"special edition",
	"anniversary edition",
	"anniversary",
	"bonus track",
	"bonus",
	"mono",
	"stereo",
	"album version",
	"single version",
	"original mix",
	"original version",
];

const IGNORABLE_TAGS_BY_LEN = [...IGNORABLE_TAGS].sort(
	(a, b) => b.length - a.length,
);

/** Strip accents/diacritics so "Beyoncé" and "Beyonce" compare equal. */
function stripDiacritics(s: string): string {
	// U+0300–U+036F = combining diacritical marks (left after NFD decomposition).
	return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Remove "feat. X", "ft. X", "featuring X" credits — noise for matching. */
function stripFeaturing(s: string): string {
	return s
		.replace(/\(\s*(feat|ft|featuring)\.?\s[^)]*\)/gi, " ")
		.replace(/\[\s*(feat|ft|featuring)\.?\s[^\]]*\]/gi, " ")
		.replace(/\s(feat|ft|featuring)\.?\s.*$/gi, " ");
}

/**
 * Split a raw title into its base form (recording identity) and the set of
 * meaningful version tags it carries. Ignorable reissue tags are dropped; the
 * base is lowercased, de-accented, de-punctuated and whitespace-collapsed.
 */
export function parseTitle(raw: string): {
	base: string;
	variants: Set<string>;
} {
	let s = stripDiacritics(String(raw ?? "")).toLowerCase();
	s = stripFeaturing(s);

	const variants = new Set<string>();
	for (const v of MEANINGFUL_VARIANTS) {
		// Word-boundary-ish match so "live" doesn't fire inside "alive".
		const re = new RegExp(
			`(^|[^a-z])${v.replace(/ /g, "\\s+")}([^a-z]|$)`,
			"i",
		);
		if (re.test(s)) variants.add(v.replace(/\s+/g, " "));
	}
	// Longest-first + word boundaries so "remaster" doesn't truncate "remastered"
	// and "deluxe" doesn't strand the "edition" half of "deluxe edition".
	for (const tag of IGNORABLE_TAGS_BY_LEN) {
		s = s.replace(new RegExp(`\\b${tag.replace(/ /g, "\\s+")}\\b`, "gi"), " ");
	}

	const base = s
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	return { base, variants };
}

/** Normalize an artist name: de-accent, drop a leading "the", &→and, de-punctuate. */
export function normalizeName(raw: string): string {
	return stripDiacritics(String(raw ?? ""))
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/^the\s+/, "")
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** Stable key fragment for the mapping cache — collapses trivial variation. */
export function keyFragment(raw: string): string {
	return parseTitle(raw).base || normalizeName(raw);
}

/** Levenshtein edit distance (iterative, two-row). */
function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;

	let prev = new Array(b.length + 1);
	let curr = new Array(b.length + 1);
	for (let j = 0; j <= b.length; j++) prev[j] = j;

	for (let i = 1; i <= a.length; i++) {
		curr[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
		}
		[prev, curr] = [curr, prev];
	}
	return prev[b.length];
}

/** Edit-distance similarity in [0,1]; 1 = identical. */
function editRatio(a: string, b: string): number {
	if (!a.length && !b.length) return 1;
	const max = Math.max(a.length, b.length);
	return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

/** Order-insensitive similarity: sort tokens before comparing. */
function tokenSortRatio(a: string, b: string): number {
	const sa = a.split(" ").filter(Boolean).sort().join(" ");
	const sb = b.split(" ").filter(Boolean).sort().join(" ");
	return editRatio(sa, sb);
}

/**
 * Similarity of two titles in [0,1], accounting for meaningful version tags.
 * A differing meaningful variant (live vs studio, remix vs original) is a real
 * mismatch and is penalized; ignorable reissue noise has already been stripped.
 */
export function titleSimilarity(query: string, candidate: string): number {
	const q = parseTitle(query);
	const c = parseTitle(candidate);

	let base = Math.max(
		editRatio(q.base, c.base),
		tokenSortRatio(q.base, c.base),
	);

	// Symmetric difference of meaningful variants → penalty per differing tag.
	let diff = 0;
	for (const v of q.variants) if (!c.variants.has(v)) diff++;
	for (const v of c.variants) if (!q.variants.has(v)) diff++;
	base -= 0.25 * diff;

	return Math.max(0, Math.min(1, base));
}

/** Similarity of two artist/entity names in [0,1]. */
export function nameSimilarity(query: string, candidate: string): number {
	const q = normalizeName(query);
	const c = normalizeName(candidate);
	if (q && q === c) return 1;
	return Math.max(editRatio(q, c), tokenSortRatio(q, c));
}

// ── Candidate selection ────────────────────────────────────────────────────

export const THRESHOLDS = {
	track: 0.6,
	album: 0.6,
	artist: 0.7,
} as const;

export interface ScoredCandidate<T> {
	item: T;
	score: number;
	popularity: number;
}

/**
 * Pick the best candidate above `threshold`, breaking near-ties (within `eps`)
 * by Tidal popularity so the canonical release wins over obscure re-uploads.
 * Returns null when nothing clears the bar — callers must NOT fall back to
 * items[0], or unrelated songs leak into mixes.
 */
export function pickBest<T>(
	scored: Array<ScoredCandidate<T>>,
	threshold: number,
	eps = 0.05,
): { item: T; score: number } | null {
	const passing = scored.filter((c) => c.score >= threshold);
	if (!passing.length) return null;
	passing.sort((a, b) => b.score - a.score || b.popularity - a.popularity);

	const top = passing[0];
	// Among candidates within `eps` of the top score, prefer highest popularity.
	let best = top;
	for (const c of passing) {
		if (top.score - c.score > eps) break;
		if (c.popularity > best.popularity) best = c;
	}
	return { item: best.item, score: best.score };
}
