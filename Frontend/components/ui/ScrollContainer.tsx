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
				className={`scrollbar-hide flex gap-6 overflow-x-auto ${className}`}
			>
				{children}
			</div>
		);
	},
);

ScrollContainer.displayName = "ScrollContainer";
