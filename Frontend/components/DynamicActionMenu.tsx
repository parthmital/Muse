import { useContextMenu, ContextMenuItem } from "@/hooks/useContextMenu";
import { ActionMenu, ActionMenuItem } from "./ui/ActionMenu";
import { usePlayer } from "@/context/PlayerContext";
import { ReactNode, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

interface DynamicActionMenuProps {
	type: string;
	id: string; // TIDAL ID
	trigger?: ReactNode;
	align?: "left" | "right";
	placement?: "top" | "bottom" | "left" | "right";
	onActionSuccess?: (action: string, data: any) => void;
	song?: any; // For track/video specific data
	openOnClick?: boolean;
}

export function DynamicActionMenu({
	type,
	id,
	trigger,
	align = "right",
	placement = "bottom",
	onActionSuccess,
	song,
	openOnClick = true,
}: DynamicActionMenuProps) {
	const { state, fetchMenu, executeAction, getMenuItems } = useContextMenu();
	const { playTrack } = usePlayer();
	const router = useRouter();
	const userId = "dev-user-001"; // TODO: Pass from context if auth exists

	const handleOpen = useCallback(() => {
		fetchMenu(type, id, userId);
	}, [type, id, userId, fetchMenu]);

	const handleAction = async (item: ContextMenuItem) => {
		if (item.action === "shuffle_play") {
			if (song) playTrack(song);
			return;
		}

		if (item.action === "navigate") {
			if (item.target === "artist") {
				const artistId =
					type === "artist" ? id : song?.tidalArtistId || song?.artistId;
				if (artistId) {
					router.push(`/artist/${artistId}`);
				}
			} else if (item.target === "album") {
				const albumId =
					type === "album" ? id : song?.tidalAlbumId || song?.albumId;
				if (albumId) {
					router.push(`/album/${albumId}`);
				}
			}
			return;
		}

		// Use the generic action handler in backend
		const result = await executeAction(
			item.action,
			type,
			id,
			userId,
			item.target,
		);
		if (onActionSuccess) onActionSuccess(item.action, result);

		// Re-fetch to update state
		fetchMenu(type, id, userId);
	};

	const items = useMemo(
		() => getMenuItems(type, state),
		[type, state, getMenuItems],
	);

	const actionItems: ActionMenuItem[] = items.map((item) => ({
		label: item.label,
		icon: item.icon,
		checked: item.active,
		onClick: () => handleAction(item),
	}));

	return (
		<ActionMenu
			trigger={trigger}
			items={actionItems}
			align={align}
			placement={placement}
			onTrigger={handleOpen}
			openOnClick={openOnClick}
		/>
	);
}
