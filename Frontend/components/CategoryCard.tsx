"use client";

import { CSSProperties } from "react";
import { FallbackImage } from "./ui/FallbackImage";
import { useColorExtraction } from "@/hooks/useColorExtraction";

interface CategoryCardProps {
	title: string;
}

export function CategoryCard({ title }: CategoryCardProps) {
	const extractedColor = useColorExtraction({
		src: `/search/${title}.png`,
		mode: "darken",
	});

	return (
		<div
			style={{ "--bg-color": extractedColor || "#202020" } as CSSProperties}
			className="relative h-44 w-44 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-(--bg-color) p-4"
		>
			<span className="text-xl font-bold text-white">{title}</span>
			<div className="absolute -right-4 -bottom-2 h-24 w-24 rotate-30">
				<FallbackImage
					src={`/search/${title}.png`}
					alt={title}
					fill
					className="rounded-lg object-cover shadow-lg shadow-black/30"
					fallbackType="Search"
				/>
			</div>
		</div>
	);
}
