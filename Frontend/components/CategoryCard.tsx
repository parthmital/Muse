"use client";

import Link from "next/link";
import { CSSProperties } from "react";

interface CategoryCardProps {
	title: string;
	disableHoverZoom?: boolean;
}

// Deterministic vibrant hue from the title so each category keeps a stable,
// distinct colour across renders (no images exist for genre/mood strings).
function hueFromString(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = (hash << 5) - hash + value.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash) % 360;
}

export function CategoryCard({
	title,
	disableHoverZoom = false,
}: CategoryCardProps) {
	const hue = hueFromString(title);
	const gradient = `linear-gradient(145deg, hsl(${hue} 62% 46%), hsl(${(hue + 28) % 360} 58% 28%))`;

	return (
		<Link
			href={`/search?q=${encodeURIComponent(title)}`}
			style={{ backgroundImage: gradient } as CSSProperties}
			className={`relative h-28 w-40 shrink-0 overflow-hidden rounded-xl p-3 sm:h-32 sm:w-48 ${
				disableHoverZoom
					? ""
					: "transition-transform hover:scale-105 active:scale-95"
			}`}
		>
			<span className="line-clamp-2 text-base font-bold tracking-tight text-white drop-shadow-sm sm:text-lg">
				{title}
			</span>
			{/* Decorative translucent disc for a touch of depth, bottom-right. */}
			<span
				aria-hidden
				className="pointer-events-none absolute -right-5 -bottom-5 h-20 w-20 rounded-full bg-white/10"
			/>
		</Link>
	);
}
