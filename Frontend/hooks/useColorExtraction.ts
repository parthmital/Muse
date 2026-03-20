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
				// Silent fail – color extraction is non-critical
			});
	}, [src, mode]);

	return extractedColor;
}
