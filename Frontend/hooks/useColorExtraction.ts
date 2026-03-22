"use client";

import { useEffect, useState } from "react";
import { FastAverageColor } from "fast-average-color";

interface ColorExtractionOptions {
	/** Image source URL */
	src: string;
	/**
	 * Adjustment mode for the extracted color:
	 * - "brighten": Brightens dark colors (adds +100 to RGB channels). Used for text on dark backgrounds.
	 * - "darken": Darkens light colors (multiplies RGB by 0.5). Used for backgrounds behind white text.
	 */
	mode: "brighten" | "darken";
}

/**
 * Extracts the dominant color from an image and adjusts it based on the mode.
 * Returns `null` while loading or if extraction fails.
 */
export function useColorExtraction({
	src,
	mode,
}: ColorExtractionOptions): string | null {
	const [extractedColor, setExtractedColor] = useState<string | null>(null);

	useEffect(() => {
		if (!src) return;

		// 1. Try backend metadata endpoint if it's a proxied Tidal image
		if (src.includes("/tidal/images/")) {
			// Extract pictureId from URL (e.g., .../tidal/images/UUID?size=...)
			const parts = src.split("/tidal/images/")[1];
			const pictureId = parts?.split("?")[0];
			if (pictureId) {
				const API_BASE =
					process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
				fetch(`${API_BASE}/tidal/images/${pictureId}/color`)
					.then((r) => r.json())
					.then((data) => {
						if (data.color) {
							// Transform hex to RGB to apply adjustments
							const hex = data.color;
							const r = parseInt(hex.slice(1, 3), 16);
							const g = parseInt(hex.slice(3, 5), 16);
							const b = parseInt(hex.slice(5, 7), 16);

							if (mode === "brighten" && (r + g + b) / 3 < 128) {
								setExtractedColor(
									`rgb(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)})`,
								);
							} else if (mode === "darken" && (r + g + b) / 3 > 128) {
								setExtractedColor(
									`rgb(${Math.floor(r * 0.5)}, ${Math.floor(g * 0.5)}, ${Math.floor(b * 0.5)})`,
								);
							} else {
								setExtractedColor(hex);
							}
							return;
						}
						// If backend doesn't have it yet, fall back to local extraction
						extractLocally();
					})
					.catch(() => extractLocally());
				return;
			}
		}

		extractLocally();

		function extractLocally() {
			const fac = new FastAverageColor();
			fac
				.getColorAsync(src, { algorithm: "dominant" })
				.then((color) => {
					if (mode === "brighten" && color.isDark) {
						const r = Math.min(255, color.value[0] + 100);
						const g = Math.min(255, color.value[1] + 100);
						const b = Math.min(255, color.value[2] + 100);
						setExtractedColor(`rgb(${r}, ${g}, ${b})`);
					} else if (mode === "darken" && color.isLight) {
						const r = Math.floor(color.value[0] * 0.5);
						const g = Math.floor(color.value[1] * 0.5);
						const b = Math.floor(color.value[2] * 0.5);
						setExtractedColor(`rgb(${r}, ${g}, ${b})`);
					} else {
						setExtractedColor(color.hex);
					}
				})
				.catch(() => {
					// Silent fail
				});
		}
	}, [src, mode]);

	return extractedColor;
}
