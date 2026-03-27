"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";

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
	const [error, setError] = useState(false);
	const [prevSrc, setPrevSrc] = useState(src);

	if (src !== prevSrc) {
		setPrevSrc(src);
		setError(false);
	}

	const fallbackSrc = `/icons/Name=${fallbackType}, Filled=No.svg`;

	if (error || !src) {
		const isFill = !!props.fill;

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
						fill
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
			className={className}
			onError={() => setError(true)}
		/>
	);
}
