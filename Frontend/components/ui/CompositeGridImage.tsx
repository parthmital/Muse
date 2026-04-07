"use client";

import Image from "next/image";
import { useState } from "react";
import { logger } from "@/lib/logger";

type FallbackType = "Playlist" | "Album" | "Artist" | "Notes" | "Search";

interface CompositeGridImageProps {
	images: string[];
	alt: string;
	fallbackType: FallbackType;
	className?: string;
}

export function CompositeGridImage({
	images,
	alt,
	fallbackType,
	className = "",
}: CompositeGridImageProps) {
	const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

	// Filter out failed images and limit to 4
	const validImages = images
		.filter((img) => img && !failedImages.has(img))
		.slice(0, 4);

	// If no valid images, use fallback
	const fallbackSrc = `/icons/Name=${fallbackType}, Filled=No.svg`;

	if (validImages.length === 0) {
		return (
			<div
				className={`flex items-center justify-center overflow-hidden rounded-lg bg-neutral-900 ${className}`}
			>
				<Image
					src={fallbackSrc}
					alt={alt}
					fill
					sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
					loading="eager"
					priority
					className="object-contain p-4 opacity-40 brightness-0 invert"
				/>
			</div>
		);
	}

	// If only 1 image, render it full size
	if (validImages.length === 1) {
		return (
			<div className={`relative overflow-hidden rounded-lg ${className}`}>
				<Image
					src={validImages[0]}
					alt={alt}
					fill
					sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
					loading="eager"
					className="object-cover"
					onError={() => {
						logger.warn("CompositeGridImage", "Image load failed", {
							src: validImages[0],
							alt,
						});
						setFailedImages((prev) => new Set([...prev, validImages[0]]));
					}}
				/>
			</div>
		);
	}

	// Render 2x2 grid for 2-4 images
	const gridCols = validImages.length === 2 ? "grid-cols-2" : "grid-cols-2";
	const gridRows = validImages.length === 2 ? "grid-rows-1" : "grid-rows-2";

	return (
		<div
			className={`grid ${gridCols} ${gridRows} gap-0.5 overflow-hidden rounded-lg ${className}`}
		>
			{validImages.map((img, index) => (
				<div key={`${img}-${index}`} className="relative">
					<Image
						src={img}
						alt={`${alt} - artist ${index + 1}`}
						fill
						sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 100px"
						loading="eager"
						className="object-cover"
						onError={() => {
							logger.warn("CompositeGridImage", "Grid image load failed", {
								src: img,
								alt,
								index,
							});
							setFailedImages((prev) => new Set([...prev, img]));
						}}
					/>
				</div>
			))}
		</div>
	);
}
