import { useContextMenu, ContextMenuItem } from "@/hooks/useContextMenu";
import { ActionMenu, ActionMenuItem } from "./ui/ActionMenu";
import { usePlayer } from "@/context/PlayerContext";
import {
	ReactNode,
	useState,
	useCallback,
	useMemo,
	useEffect,
	useRef,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Dialog } from "./ui/Dialog";
import { usePlaylistManager } from "@/hooks/usePlaylistManager";
import { getRecommendations } from "@/lib/api";
import { tidalTrackToSong } from "@/lib/tidalAdapter";
import { useAuth } from "@/context/AuthContext";

interface DynamicActionMenuProps {
	type: string;
	id: string;
	trigger?: ReactNode;
	align?: "left" | "right";
	placement?: "top" | "bottom" | "left" | "right";
	onActionSuccess?: (action: string, data: any) => void;
	song?: any;
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
	const { user } = useAuth();
	const userId = user?.id ?? "";

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
			if (song?.tidalId) {
				try {
					const recommendations = await getRecommendations(song.tidalId);
					if (recommendations.items) {
						const recSongs = recommendations.items.map(tidalTrackToSong);
						playPlaylist([song, ...recSongs]);
					}
				} catch {
					// Silently fail
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
							{/* eslint-disable-next-line @next/next/no-img-element */}
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
							<p className="font-mono text-white">{song?.tidalId}</p>
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

// "Add to a playlist" modal — built to match the Reference/ spec exactly:
// header + search + "New playlist" row + selectable playlist rows (gray circle →
// green check when selected) + Cancel/Done footer. Selection is staged locally
// and only written on Done. All icons render at their native 40px.
function PlaylistSelectDialog({
	isOpen,
	onClose,
	song,
}: {
	isOpen: boolean;
	onClose: () => void;
	song: any;
}) {
	const { data, toggleSongInPlaylist, playlistsContaining, createPlaylist } =
		usePlaylistManager();
	const playlists = data?.playlists ?? [];
	const songKey = String(song?.tidalId || song?.id || "");

	// `original` = membership when opened; `selected` = staged membership.
	const [original, setOriginal] = useState<Set<string>>(new Set());
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [query, setQuery] = useState("");
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [busy, setBusy] = useState(false);
	const newNameRef = useRef<HTMLInputElement>(null);

	// Load current membership each time the dialog opens.
	useEffect(() => {
		if (!isOpen || !songKey) return;
		let cancelled = false;
		setQuery("");
		setCreating(false);
		setNewName("");
		playlistsContaining(songKey).then((set) => {
			if (cancelled) return;
			setOriginal(set);
			setSelected(new Set(set));
		});
		return () => {
			cancelled = true;
		};
	}, [isOpen, songKey, playlistsContaining]);

	useEffect(() => {
		if (creating) newNameRef.current?.focus();
	}, [creating]);

	// Close on Escape.
	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [isOpen, onClose]);

	if (!isOpen || typeof document === "undefined") return null;

	const toggle = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleCreate = async () => {
		const title = newName.trim();
		if (!title || busy) return;
		setBusy(true);
		try {
			const id = await createPlaylist(title);
			setSelected((prev) => new Set(prev).add(id));
			setNewName("");
			setCreating(false);
		} finally {
			setBusy(false);
		}
	};

	const handleDone = async () => {
		if (!songKey) {
			onClose();
			return;
		}
		setBusy(true);
		try {
			// Apply only the playlists whose membership actually changed.
			const changed = [
				...[...selected].filter((id) => !original.has(id)),
				...[...original].filter((id) => !selected.has(id)),
			];
			for (const id of changed) {
				await toggleSongInPlaylist(id, songKey);
			}
			onClose();
		} finally {
			setBusy(false);
		}
	};

	const filtered = playlists.filter((p) =>
		p.title.toLowerCase().includes(query.toLowerCase()),
	);

	return createPortal(
		<div
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			className="animate-in fade-in fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200"
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Add to a playlist"
				className="animate-in zoom-in-95 flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl duration-200"
			>
				{/* Header */}
				<div className="border-b border-neutral-800 px-6 py-4">
					<h2 className="text-base font-semibold text-neutral-200">
						Add to a playlist
					</h2>
				</div>

				{/* Search */}
				<div className="px-6 pt-4">
					<div className="flex h-14 items-center gap-2 rounded-xl bg-neutral-950 pr-3 pl-4">
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search for a playlist/folder"
							className="flex-1 bg-transparent text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none"
						/>
						<Image
							src="/icons/Name=Search, Filled=No.svg"
							alt=""
							width={40}
							height={40}
							className="shrink-0"
						/>
					</div>
				</div>

				{/* List */}
				<div className="flex max-h-80 flex-col overflow-y-auto px-3 py-2">
					{/* New playlist */}
					{creating ? (
						<div className="flex items-center gap-3 rounded-xl px-3 py-2">
							<Image
								src="/icons/Name=Add Simple, Filled=No.svg"
								alt=""
								width={40}
								height={40}
								className="shrink-0"
							/>
							<input
								ref={newNameRef}
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleCreate();
									if (e.key === "Escape") {
										setCreating(false);
										setNewName("");
									}
								}}
								placeholder="Playlist name"
								disabled={busy}
								className="flex-1 bg-transparent text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none"
							/>
							<button
								onClick={handleCreate}
								disabled={busy || !newName.trim()}
								className="text-sm font-semibold text-green-500 disabled:opacity-40"
							>
								Create
							</button>
						</div>
					) : (
						<button
							onClick={() => setCreating(true)}
							className="flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-800"
						>
							<Image
								src="/icons/Name=Add Simple, Filled=No.svg"
								alt=""
								width={40}
								height={40}
								className="shrink-0"
							/>
							<span className="flex-1 text-sm text-neutral-200">
								New playlist
							</span>
						</button>
					)}

					{/* Existing playlists */}
					{filtered.map((p) => {
						const isSel = selected.has(p.id);
						return (
							<button
								key={p.id}
								onClick={() => toggle(p.id)}
								className="flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-800"
							>
								<Image
									src="/icons/Name=Playlist, Filled=No.svg"
									alt=""
									width={40}
									height={40}
									className="shrink-0"
								/>
								<span className="flex-1 truncate text-sm text-neutral-200">
									{p.title}
								</span>
								<Image
									src={`/icons/Name=Check, Filled=${isSel ? "Yes" : "No"}.svg`}
									alt={isSel ? "Selected" : "Not selected"}
									width={40}
									height={40}
									className="shrink-0"
								/>
							</button>
						);
					})}

					{playlists.length === 0 && !creating && (
						<p className="px-3 py-6 text-center text-sm text-neutral-500">
							No playlists yet. Create one above.
						</p>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 border-t border-neutral-800 px-6 py-4">
					<button
						onClick={onClose}
						disabled={busy}
						className="px-4 py-2 text-sm font-semibold text-neutral-500 transition-colors hover:text-neutral-300"
					>
						Cancel
					</button>
					<button
						onClick={handleDone}
						disabled={busy}
						className="rounded-xl bg-green-500 px-6 py-2 text-sm font-semibold text-black transition-colors hover:bg-green-400 disabled:opacity-60"
					>
						Done
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
