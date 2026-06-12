"use client";

import { useCallback } from "react";
import { useToast } from "@/context/ToastContext";
import { shareItem } from "@/lib/share";

/**
 * Shared handlers for the secondary media actions (share, download) used across
 * album/playlist/track surfaces. Keeps the toast wiring in one place.
 */
export function useMediaActions() {
	const { toast } = useToast();

	const share = useCallback(
		async (title: string, url?: string) => {
			const result = await shareItem({ title, url });
			if (result === "copied") {
				toast("Link copied to clipboard");
			} else if (result === "failed") {
				toast({ message: "Couldn't share this", variant: "error" });
			}
			// "shared" / "cancelled" need no toast.
		},
		[toast],
	);

	// Offline downloads aren't built yet; give clear feedback instead of a
	// silent no-op so the control isn't dead.
	const download = useCallback(() => {
		toast("Downloads are coming soon");
	}, [toast]);

	return { share, download };
}
