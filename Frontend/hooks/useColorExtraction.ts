"use client";

import { useEffect, useState } from "react";

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

import { getExtractedColor } from "@/utils/images";

export function useColorExtraction({
	src,
	mode,
}: ColorExtractionOptions): string | null {
	const [extractedColor, setExtractedColor] = useState<string | null>(null);

	useEffect(() => {
		if (!src) {
			setExtractedColor(null);
			return;
		}

		// Use the centralized utility for color extraction
		getExtractedColor(src, mode)
			.then((color) => {
				setExtractedColor(color);
			})
			.catch(() => setExtractedColor(null));
	}, [src, mode]);

	return extractedColor;
}
