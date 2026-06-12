"use client";

import { MediaCard, MediaItem } from "./MediaCard";

interface MediaGridProps {
	items: MediaItem[];
	className?: string;
	disableHoverTransitions?: boolean;
}

export function MediaGrid({
	items,
	className = "",
	disableHoverTransitions = false,
}: MediaGridProps) {
	if (items.length === 0) {
		return (
			<div className="flex w-full flex-col items-center justify-center py-20 text-center">
				<p className="text-neutral-500">No items found.</p>
			</div>
		);
	}

	return (
		<div className={`flex flex-wrap gap-x-4 gap-y-6 md:gap-6 ${className}`}>
			{items.map((item) => (
				<MediaCard
					key={`${item.type ?? "media"}-${String(item.tidalId ?? item.title)}`}
					item={item}
					disableHoverTransitions={disableHoverTransitions}
				/>
			))}
		</div>
	);
}
