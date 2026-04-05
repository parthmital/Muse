"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { logger } from "@/lib/logger";

type FallbackType = "Playlist" | "Album" | "Artist" | "Notes" | "Search";

interface FallbackImageProps extends Omit<ImageProps, "src"> {
	src?: string | null;
	fallbackType: FallbackType;
}

export function FallbackImage({
	src,
	fallbackType,
	alt,
	className,
	...props
}: FallbackImageProps) {
	const [failedSrc, setFailedSrc] = useState<string | null>(null);
	const didCurrentSrcFail = !!src && failedSrc === src;
	const isFill = !!props.fill;
	const resolvedSizes = isFill ? (props.sizes ?? "100vw") : props.sizes;

	const fallbackSrc = `/icons/Name=${fallbackType}, Filled=No.svg`;

	if (didCurrentSrcFail || !src) {
		return (
			<div
				className={`flex items-center justify-center overflow-hidden bg-neutral-900 ${
					isFill ? "relative h-full w-full" : ""
				} ${className}`}
			>
				<div
					className="relative flex items-center justify-center"
					style={{
						width: isFill ? "100%" : props.width,
						height: isFill ? "100%" : props.height,
					}}
				>
					<Image
						src={fallbackSrc}
						alt={alt || fallbackType}
						fill={isFill}
						width={isFill ? undefined : (props.width ?? 48)}
						height={isFill ? undefined : (props.height ?? 48)}
						sizes={resolvedSizes}
						className="object-contain opacity-40 brightness-0 invert"
					/>
				</div>
			</div>
		);
	}

	return (
		<Image
			{...props}
			src={src}
			alt={alt}
			sizes={resolvedSizes}
			className={className}
			onError={() => {
				logger.warn(
					"FallbackImage",
					"Image load failed, switching to fallback",
					{
						src,
						alt,
						fallbackType,
					},
				);
				setFailedSrc(src ?? null);
			}}
		/>
	);
}
