"use client";

import { ReactNode, createContext, useRef } from "react";

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

	return (
		<PageContainerContext.Provider value={{ containerRef }}>
			<div
				ref={containerRef}
				data-page-container="true"
				className={`scrollbar-hide relative flex grow flex-col gap-6 overflow-auto rounded-lg border border-neutral-800 p-6 ${className}`}
			>
				{children}
			</div>
		</PageContainerContext.Provider>
	);
}
