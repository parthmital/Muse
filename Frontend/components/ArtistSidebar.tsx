"use client";

import { useState } from "react";
import { FallbackImage } from "@/components/ui/FallbackImage";
import Link from "next/link";

interface SimilarArtist {
	name: string;
	url: string;
	image?: string;
}

interface ArtistSidebarProps {
	biography: string;
	tags: string[];
	similarArtists?: SimilarArtist[];
	artistPicture?: string;
}

export function ArtistSidebar({
	biography,
	tags,
	similarArtists = [],
	artistPicture,
}: ArtistSidebarProps) {
	const [isBioExpanded, setIsBioExpanded] = useState(false);

	// Strip HTML tags from biography and truncate
	const stripHtml = (html: string) => {
		if (typeof window === "undefined") {
			// SSR-safe: use regex to strip tags
			return html.replace(/<[^>]*>/g, "");
		}
		const tmp = document.createElement("DIV");
		tmp.innerHTML = html;
		return tmp.textContent || tmp.innerText || "";
	};

	const cleanBio = stripHtml(biography);
	const shouldTruncate = cleanBio.length > 300;
	const displayBio = isBioExpanded
		? cleanBio
		: cleanBio.substring(0, 300) + (shouldTruncate ? "..." : "");

	return (
		<div className="flex w-80 shrink-0 flex-col gap-6">
			{/* Biography Section */}
			<div className="flex flex-col gap-6">
				<div className="relative aspect-video overflow-hidden rounded-lg border border-neutral-800/50">
					<FallbackImage
						src={artistPicture || ""}
						alt="Bio"
						fill
						sizes="320px"
						className="object-cover"
						fallbackType="Artist"
					/>
				</div>

				{cleanBio && (
					<div className="flex flex-col gap-2">
						<p className="text-base leading-relaxed text-neutral-300">
							{displayBio}
							{shouldTruncate && (
								<button
									onClick={() => setIsBioExpanded(!isBioExpanded)}
									className="ml-1 font-medium text-white hover:underline"
								>
									{isBioExpanded ? "Read less" : "Read more"}
								</button>
							)}
						</p>
					</div>
				)}

				{/* Tags */}
				{tags.length > 0 && (
					<div className="flex flex-wrap gap-3">
						{tags.map((tag, index) => (
							<span
								key={`${tag}-${index}`}
								className="rounded-lg border border-neutral-800 px-4 py-2 text-sm text-neutral-400"
							>
								{tag}
							</span>
						))}
					</div>
				)}

				{/* Similar Artists */}
				{similarArtists.length > 0 && (
					<div className="flex flex-col gap-4">
						<h3 className="text-lg font-bold text-white">Similar Artists</h3>
						<div className="flex flex-col gap-3">
							{similarArtists.slice(0, 5).map((artist, index) => (
								<Link
									key={`${artist.name}-${index}`}
									href={`/artist/${encodeURIComponent(artist.name)}`}
									className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-neutral-800"
								>
									<div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-neutral-800">
										<FallbackImage
											src={artist.image || ""}
											alt={artist.name}
											fill
											sizes="48px"
											className="object-cover"
											fallbackType="Artist"
										/>
									</div>
									<span className="font-medium text-white">{artist.name}</span>
								</Link>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
