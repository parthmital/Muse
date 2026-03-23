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
	const { playTrack, playNext, addToQueue, playPlaylist } = usePlayer();
	const router = useRouter();
	const userId = "dev-user-001";

	const [infoOpen, setInfoOpen] = useState(false);
	const [playlistOpen, setPlaylistOpen] = useState(false);

	const handleOpen = useCallback(() => {
		fetchMenu(type, id, userId);
	}, [type, id, userId, fetchMenu]);

	const handleAction = async (item: ContextMenuItem) => {
		if (item.action === "shuffle_play") {
			if (song) playTrack(song);
			return;
		}

		if (item.action === "play_next") {
			if (song) playNext(song);
			return;
		}

		if (item.action === "add_to_queue") {
			if (song) addToQueue(song);
			return;
		}

		if (item.action === "mix") {
			if (song && song.tidalId) {
				const recommendations = await fetch(
					`http://localhost:8000/tidal/tracks/${song.tidalId}/recommendations`,
				).then((res) => res.json());
				if (recommendations.items) {
					playPlaylist([song, ...recommendations.items]);
				}
			}
			return;
		}

		if (item.action === "track_info") {
			setInfoOpen(true);
			return;
		}

		if (item.action === "add_to_playlist") {
			setPlaylistOpen(true);
			return;
		}

		if (item.action === "navigate") {
			if (item.target === "artist") {
				const artistId =
					type === "artist" ? id : song?.tidalArtistId || song?.artistId;
				if (artistId) router.push(`/artist/${artistId}`);
			} else if (item.target === "album") {
				const albumId =
					type === "album" ? id : song?.tidalAlbumId || song?.albumId;
				if (albumId) router.push(`/album/${albumId}`);
			}
			return;
		}

		const result = await executeAction(
			item.action,
			type,
			id,
			userId,
			item.target,
		);
		if (onActionSuccess) onActionSuccess(item.action, result);
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
		<>
			<ActionMenu
				trigger={trigger}
				items={actionItems}
				align={align}
				placement={placement}
				onTrigger={handleOpen}
				openOnClick={openOnClick}
			/>

			{/* Track Info Dialog */}
			<Dialog
				isOpen={infoOpen}
				onClose={() => setInfoOpen(false)}
				title="Track Information"
			>
				<div className="space-y-4">
					<div className="flex gap-4">
						<div className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-neutral-800">
							{song?.img && (
								<img
									src={song.img}
									alt={song.title}
									className="h-full w-full object-cover"
								/>
							)}
						</div>
						<div>
							<h3 className="text-lg font-bold text-white">{song?.title}</h3>
							<p className="text-neutral-400">{song?.artist}</p>
							<p className="text-sm text-neutral-500">{song?.album}</p>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4 rounded-lg bg-neutral-800/50 p-4 text-sm">
						<div>
							<p className="text-neutral-500">Duration</p>
							<p className="text-white">{song?.duration}</p>
						</div>
						<div>
							<p className="text-neutral-500">Tidal ID</p>
							<p className="text-white font-mono">{song?.tidalId}</p>
						</div>
					</div>
				</div>
			</Dialog>

			{/* Add to Playlist Dialog */}
			<PlaylistSelectDialog
				isOpen={playlistOpen}
				onClose={() => setPlaylistOpen(false)}
				song={song}
			/>
		</>
	);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

import { Dialog } from "./ui/Dialog";
import { usePlaylistManager } from "@/hooks/usePlaylistManager";

function PlaylistSelectDialog({
	isOpen,
	onClose,
	song,
}: {
	isOpen: boolean;
	onClose: () => void;
	song: any;
}) {
	const { data } = usePlaylistManager() as any;
	const playlists = data?.playlists || [];

	const handleAdd = async (playlistId: string) => {
		await fetch(`http://localhost:8000/playlists/${playlistId}/tracks`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ trackId: song?.tidalId || song?.id }),
		});
		onClose();
	};

	return (
		<Dialog isOpen={isOpen} onClose={onClose} title="Add to Playlist">
			<div className="max-h-60 space-y-2 overflow-y-auto pr-2">
				{playlists.map((p: any) => (
					<button
						key={p.id}
						onClick={() => handleAdd(p.id)}
						className="w-full rounded-lg bg-neutral-800 px-4 py-3 text-left transition-colors hover:bg-neutral-700"
					>
						<div className="font-bold text-white">{p.title}</div>
						<div className="text-xs text-neutral-400">
							{p.numberOfTracks || 0} tracks
						</div>
					</button>
				))}
				{playlists.length === 0 && (
					<p className="py-4 text-center text-neutral-500">
						No playlists found. Create one first!
					</p>
				)}
			</div>
		</Dialog>
	);
}
