"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		logger.error(
			"AppErrorBoundary",
			"Route-level error boundary triggered",
			error,
			{
				digest: error.digest,
			},
		);
	}, [error]);

	return (
		<div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
			<h2 className="font-medium text-red-300">Something went wrong.</h2>
			<p className="mt-2 text-sm text-neutral-400">
				Check console logs for `AppErrorBoundary` details.
			</p>
			<button
				className="mt-4 rounded bg-red-400 px-3 py-1 text-sm font-medium text-black"
				onClick={() => reset()}
			>
				Try again
			</button>
		</div>
	);
}
