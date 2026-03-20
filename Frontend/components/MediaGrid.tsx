"use client";

import { MediaCard, MediaItem } from "./MediaCard";

interface MediaGridProps {
	items: MediaItem[];
	className?: string;
}

export function MediaGrid({ items, className = "" }: MediaGridProps) {
	if (items.length === 0) {
		return (
			<div className="flex w-full flex-col items-center justify-center py-20 text-center">
				<p className="text-neutral-500">No items found.</p>
			</div>
		);
	}

	return (
		<div className={`flex flex-wrap gap-6 ${className}`}>
			{items.map((item, index) => (
				<MediaCard key={`${item.title}-${index}`} item={item} />
			))}
		</div>
	);
}
