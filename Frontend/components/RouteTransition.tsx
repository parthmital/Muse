"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Replays a subtle enter animation on every client navigation by re-keying on
 * the pathname. Mirrors PageContainer's flex/gap so page layouts are unchanged.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	return (
		<div
			key={pathname}
			className="flex grow flex-col gap-6 duration-300 animate-in fade-in slide-in-from-bottom-1"
		>
			{children}
		</div>
	);
}
