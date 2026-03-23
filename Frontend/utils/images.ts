/**
 * utils/images.ts
 *
 * Utility functions for generating Tidal image URLs and handling fallbacks,
 * based on the Monochrome reference implementation.
 * All TIDAL images are proxied via the Muse backend to avoid CORS issues
 * and to enable server-side color extraction.
 */

const API_BASE =
	process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const SUPPORTED_SIZES = [80, 160, 320, 640, 1280] as const;
export type ImageSize = (typeof SUPPORTED_SIZES)[number];

/**
 * Normalizes a Tidal image ID (slug) for use in Muse proxy routes.
 * Replaces slashes with dashes.
 */
function normalizeId(id: string | number): string {
	return String(id).replace(/\//g, "-");
}

/**
 * Generates a proxied URL for a square item cover (album, playlist, etc).
 */
export function getCoverUrl(
	id: string | number | null | undefined,
	size: ImageSize | string = 320,
): string {
	if (!id) return "";
	if (
		typeof id === "string" &&
		(id.startsWith("http") ||
			id.startsWith("blob:") ||
			id.startsWith("assets/"))
	) {
		return id;
	}
	const formattedId = normalizeId(id);
	return `${API_BASE}/tidal/images/${formattedId}?size=${size}&type=square`;
}

/**
 * Generates a proxied URL for an artist picture.
 */
export function getArtistPictureUrl(
	id: string | number | null | undefined,
	size: ImageSize | string = 320,
): string {
	if (!id) return "";
	if (
		typeof id === "string" &&
		(id.startsWith("http") ||
			id.startsWith("blob:") ||
			id.startsWith("assets/"))
	) {
		return id;
	}
	const formattedId = normalizeId(id);
	return `${API_BASE}/tidal/images/${formattedId}?size=${size}&type=square`;
}

/**
 * Generates a proxied URL for a video cover.
 */
export function getVideoCoverUrl(
	id: string | number | null | undefined,
	size: ImageSize | string = 1280,
): string {
	if (!id) return "";
	if (
		typeof id === "string" &&
		(id.startsWith("http") ||
			id.startsWith("blob:") ||
			id.startsWith("assets/"))
	) {
		return id;
	}
	const formattedId = normalizeId(id);
	return `${API_BASE}/tidal/images/${formattedId}?size=${size}&type=video`;
}

/**
 * Helper to get the extracted color from the backend for a given image.
 */
export async function getExtractedColor(
	src: string,
	mode: "brighten" | "darken" = "brighten",
): Promise<string | null> {
	if (!src || !src.includes("/tidal/images/")) return null;

	try {
		const parts = src.split("/tidal/images/")[1];
		const [idAndParams] = parts.split("?");
		const params = new URLSearchParams(parts.split("?")[1] || "");

		const size = params.get("size") || "640";
		const type = params.get("type") || "square";

		const res = await fetch(
			`${API_BASE}/tidal/images/${idAndParams}/color?mode=${mode}&size=${size}&type=${type}`,
		);
		const data = await res.json();
		return data.color || null;
	} catch (err) {
		console.error("Failed to fetch extracted color:", err);
		return null;
	}
}
