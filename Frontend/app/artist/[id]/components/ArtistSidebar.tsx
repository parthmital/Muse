"use client";

import { FallbackImage } from "@/components/ui/FallbackImage";

interface ArtistSidebarProps {
	biography: string;
	tags: string[];
	artistPicture?: string;
}

export function ArtistSidebar({
	biography,
	tags,
	artistPicture,
}: ArtistSidebarProps) {
	return (
		<div className="flex w-80 shrink-0 flex-col gap-6">
			{/* Biography Section */}
			<div className="flex flex-col gap-6">
				<div className="relative aspect-video overflow-hidden rounded-lg border border-neutral-800/50">
					<FallbackImage
						src={artistPicture || ""}
						alt="Bio"
						fill
						className="object-cover"
						fallbackType="Artist"
					/>
				</div>
				<p className="text-base leading-relaxed">{biography}</p>
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
			</div>
		</div>
	);
}
