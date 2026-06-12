"use client";

import { forwardRef, ReactNode } from "react";

interface ScrollContainerProps {
	children: ReactNode;
	className?: string;
}

export const ScrollContainer = forwardRef<HTMLDivElement, ScrollContainerProps>(
	({ children, className = "" }, ref) => {
		return (
			<div
				ref={ref}
				className={`scrollbar-hide flex gap-4 overflow-x-auto md:gap-6 ${className}`}
			>
				{children}
			</div>
		);
	},
);

ScrollContainer.displayName = "ScrollContainer";
