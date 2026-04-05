"use client";

import useSWR from "swr";
import { getExtractedColor } from "@/utils/images";

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

export function useColorExtraction({
	src,
	mode,
}: ColorExtractionOptions): string | null {
	const { data } = useSWR(
		src ? ["extracted-color", src, mode] : null,
		([, imageSrc, adjustmentMode]) =>
			getExtractedColor(
				imageSrc as string,
				adjustmentMode as "brighten" | "darken",
			),
		{
			revalidateOnFocus: false,
			revalidateOnReconnect: false,
		},
	);

	return data ?? null;
}
