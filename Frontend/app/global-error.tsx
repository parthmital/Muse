"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		logger.error(
			"GlobalErrorBoundary",
			"Global error boundary triggered",
			error,
			{
				digest: error.digest,
			},
		);
	}, [error]);

	return (
		<html lang="en">
			<body className="bg-black p-6 text-neutral-300">
				<div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
					<h2 className="font-medium text-red-300">
						Critical application error.
					</h2>
					<p className="mt-2 text-sm text-neutral-400">
						Check console logs for `GlobalErrorBoundary` details.
					</p>
					<button
						className="mt-4 rounded bg-red-400 px-3 py-1 text-sm font-medium text-black"
						onClick={() => reset()}
					>
						Reload
					</button>
				</div>
			</body>
		</html>
	);
}
