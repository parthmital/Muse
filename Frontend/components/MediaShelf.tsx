"use client";

import { useRef } from "react";
import { SectionHeader } from "./SectionHeader";
import { ScrollContainer } from "./ui/ScrollContainer";
import { MediaCard, MediaItem } from "./MediaCard";

interface MediaShelfProps {
	title: string;
	items: MediaItem[];
	titleClassName?: string;
}

export function MediaShelf({ title, items, titleClassName }: MediaShelfProps) {
	const scrollRef = useRef<HTMLDivElement>(null);

	return (
		<div className="flex flex-col gap-4">
			<SectionHeader
				title={title}
				scrollRef={scrollRef}
				titleClassName={titleClassName}
			/>
			<ScrollContainer ref={scrollRef}>
				{items.length > 0 ? (
					items.map((item, index) => (
						<MediaCard key={`${item.title}-${index}`} item={item} />
					))
				) : (
					<div className="flex w-full items-center justify-center rounded-lg border border-dashed border-neutral-800 p-8">
						<p className="text-neutral-500">No items available</p>
					</div>
				)}
			</ScrollContainer>
		</div>
	);
}
