"use client";

export function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded-lg bg-neutral-800/50 ${className}`}
		/>
	);
}
