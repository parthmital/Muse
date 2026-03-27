"use client";

import Link from "next/link";
import { CSSProperties } from "react";
import { FallbackImage } from "./ui/FallbackImage";
import { useColorExtraction } from "@/hooks/useColorExtraction";

interface CategoryCardProps {
	title: string;
}

export function CategoryCard({ title }: CategoryCardProps) {
	const extractedColor = useColorExtraction({
		src: "",
		mode: "darken",
	});

	return (
		<Link
			href={`/search?q=${encodeURIComponent(title)}`}
			style={{ "--bg-color": extractedColor || "#202020" } as CSSProperties}
			className="relative h-44 w-44 shrink-0 block cursor-pointer overflow-hidden rounded-lg bg-(--bg-color) p-4 transition-transform hover:scale-105 active:scale-95"
		>
			<span className="text-xl font-bold text-white tracking-tight">
				{title}
			</span>
			<div className="absolute -right-4 -bottom-2 h-24 w-24 rotate-30">
				<FallbackImage
					src=""
					alt={title}
					fill
					className="rounded-lg object-cover shadow-lg shadow-black/30"
					fallbackType="Search"
				/>
			</div>
		</Link>
	);
}
