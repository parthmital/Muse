"use client";

import { useCallback } from "react";

export interface MediaActionItem {
	label: string;
	icon: string;
	onClick: () => void;
	variant?: "default" | "danger";
}

export function useMediaActions() {
	const handlePlay = useCallback((itemContext: string) => {
		console.log("Playing", itemContext);
	}, []);

	const handleAddToQueue = useCallback((itemContext: string) => {
		console.log("Adding to queue", itemContext);
	}, []);

	const handleShare = useCallback((itemContext: string) => {
		console.log("Sharing", itemContext);
		if (navigator.share) {
			navigator
				.share({
					title: "Check this out on Muse",
					url: window.location.href,
				})
				.catch(console.error);
		}
	}, []);

	const handleDownload = useCallback((itemContext: string) => {
		console.log("Downloading", itemContext);
	}, []);

	const generateStandardActions = useCallback(
		(
			itemContext: string,
			isPinned?: boolean,
			togglePin?: () => void,
			isArtist?: boolean,
		): MediaActionItem[] => {
			const actions: MediaActionItem[] = [];

			if (togglePin) {
				actions.push({
					label: isPinned ? "Unpin" : "Pin",
					icon: "Pin",
					onClick: togglePin,
				});
			}

			if (!isArtist) {
				actions.push({
					label: "Add to Queue",
					icon: "Add to Queue",
					onClick: () => handleAddToQueue(itemContext),
				});
				actions.push({
					label: "Download",
					icon: "Download",
					onClick: () => handleDownload(itemContext),
				});
			}

			actions.push({
				label: "Share",
				icon: "Share",
				onClick: () => handleShare(itemContext),
			});

			return actions;
		},
		[handleAddToQueue, handleDownload, handleShare],
	);

	return {
		handlePlay,
		handleAddToQueue,
		handleShare,
		handleDownload,
		generateStandardActions,
	};
}
