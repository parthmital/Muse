/**
 * src/services/imageComposer.ts
 *
 * Composites artist images into grid layouts for playlist/mix covers.
 */

import { Jimp } from "jimp";

/**
 * Create a single-color placeholder image
 */
export async function createPlaceholderImage(
	color: number,
	size = 640,
): Promise<Buffer> {
	const image = new Jimp({ width: size, height: size, color });
	return await image.getBuffer("image/jpeg");
}
