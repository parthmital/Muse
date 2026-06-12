"use client";

import Image from "next/image";
import Link from "next/link";

interface EmptyStateProps {
	icon?: string;
	title: string;
	description?: string;
	actionLabel?: string;
	actionHref?: string;
	onAction?: () => void;
	variant?: "default" | "error";
}

/**
 * Consistent empty / error state — an icon, a headline, a hint, and an optional
 * call to action. Replaces ad-hoc "No results" text scattered across pages.
 */
export function EmptyState({
	icon = "Search",
	title,
	description,
	actionLabel,
	actionHref,
	onAction,
	variant = "default",
}: EmptyStateProps) {
	const action = actionLabel ? (
		actionHref ? (
			<Link
				href={actionHref}
				className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition-transform hover:scale-105"
			>
				{actionLabel}
			</Link>
		) : (
			<button
				onClick={onAction}
				className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition-transform hover:scale-105"
			>
				{actionLabel}
			</button>
		)
	) : null;

	return (
		<div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
			<div
				className={`mb-2 flex h-16 w-16 items-center justify-center rounded-full ${
					variant === "error" ? "bg-red-500/10" : "bg-neutral-800/60"
				}`}
			>
				<Image
					src={`/icons/Name=${icon}, Filled=No.svg`}
					alt=""
					width={40}
					height={40}
					className="opacity-60 brightness-0 invert"
				/>
			</div>
			<p className="text-lg font-bold text-white">{title}</p>
			{description && (
				<p className="max-w-sm text-sm text-neutral-500">{description}</p>
			)}
			{action}
		</div>
	);
}
