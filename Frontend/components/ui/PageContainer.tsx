"use client";

import { ReactNode, createContext, useRef } from "react";
import { usePlayer } from "@/context/PlayerContext";

interface PageContainerContextType {
	containerRef: React.RefObject<HTMLDivElement | null>;
}

export const PageContainerContext =
	createContext<PageContainerContextType | null>(null);

interface PageContainerProps {
	children: ReactNode;
	className?: string;
}

export function PageContainer({
	children,
	className = "",
}: PageContainerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const { currentTrack } = usePlayer();

	// Mobile reserves space for the fixed bottom nav; only reserve the taller
	// gap for the floating mini-player when a track is actually playing.
	// (Desktop's md:p-6 overrides this, so it's unaffected.)
	const mobileBottomPad = currentTrack ? "pb-40" : "pb-28";

	return (
		<PageContainerContext.Provider value={{ containerRef }}>
			<div
				ref={containerRef}
				data-page-container="true"
				className={`relative flex grow flex-col gap-6 overflow-auto border-neutral-800 p-4 ${mobileBottomPad} md:rounded-lg md:border md:p-6 ${className}`}
			>
				{children}
			</div>
		</PageContainerContext.Provider>
	);
}
