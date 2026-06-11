"use client";

import { RefObject, useCallback, useEffect, useState } from "react";
import { IconButton } from "./ui/IconButton";

interface SectionHeaderProps {
	title: string;
	subtitle?: string;
	scrollRef?: RefObject<HTMLDivElement | null>;
	titleClassName?: string;
	controls?: boolean;
}

export function SectionHeader({
	title,
	subtitle,
	scrollRef,
	titleClassName = "text-xl font-bold",
	controls = true,
}: SectionHeaderProps) {
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(true);

	const checkScroll = useCallback(() => {
		if (scrollRef?.current) {
			const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
			setCanScrollLeft(scrollLeft > 0);
			setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
		}
	}, [scrollRef]);

	useEffect(() => {
		const el = scrollRef?.current;
		if (el) {
			checkScroll();
			el.addEventListener("scroll", checkScroll);
			window.addEventListener("resize", checkScroll);
			return () => {
				el.removeEventListener("scroll", checkScroll);
				window.removeEventListener("resize", checkScroll);
			};
		}
	}, [scrollRef, checkScroll]);

	const handleScroll = (direction: "left" | "right") => {
		if (scrollRef?.current) {
			const scrollAmount = 400;
			scrollRef.current.scrollBy({
				left: direction === "left" ? -scrollAmount : scrollAmount,
				behavior: "smooth",
			});
		}
	};

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="min-w-0">
				<p className={`${titleClassName} line-clamp-1 text-white`}>{title}</p>
				{subtitle && (
					<p className="line-clamp-1 text-sm text-neutral-400">{subtitle}</p>
				)}
			</div>
			{controls && (
				<div className="flex items-center gap-1">
					<IconButton
						icon="Arrow-Left"
						alt="Scroll Left"
						onClick={() => handleScroll("left")}
						disabled={!canScrollLeft}
					/>
					<IconButton
						icon="Arrow-Right"
						alt="Scroll Right"
						onClick={() => handleScroll("right")}
						disabled={!canScrollRight}
					/>
				</div>
			)}
		</div>
	);
}
