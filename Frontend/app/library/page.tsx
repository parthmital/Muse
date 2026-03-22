"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FilterBar } from "@/components/FilterBar";
import { MediaGrid } from "@/components/MediaGrid";
import { TrackInfo } from "@/components/TrackInfo";
import { IconButton } from "@/components/ui/IconButton";
import { MediaItem } from "@/components/MediaCard";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Dialog } from "@/components/ui/Dialog";
import { useLibraryManager } from "@/hooks/useLibraryManager";
import { useViewMode } from "@/hooks/useViewMode";
import { useSearchFilter } from "@/hooks/useSearchFilter";
import { useDialogState } from "@/hooks/useDialogState";
import { useSorting } from "@/hooks/useSorting";
import { LibrarySkeleton } from "@/components/ui/Skeletons";

// We no longer rely on ANY static data.

function LibraryContentInner() {
	const searchParams = useSearchParams();
	const filter = searchParams.get("filter");
	const { viewMode, setViewMode } = useViewMode("grid");
	const {
		isOpen: isCreateDialogOpen,
		open: openCreateDialog,
		close: closeCreateDialog,
	} = useDialogState();
	const [newPlaylistName, setNewPlaylistName] = useState("");
	const [createError, setCreateError] = useState<string | null>(null);

	const {
		customPlaylists,
		pinnedItems,
		isInitialized,
		isInLibrary,
		togglePin,
		addCustomPlaylist,
		removeCustomPlaylist,
	} = useLibraryManager();

	const allItems = [...customPlaylists];

	const { setSearchQuery, filteredItems } = useSearchFilter(
		allItems,
		(item, query) => {
			const matchesQuery =
				item.title.toLowerCase().includes(query.toLowerCase()) ||
				(item.artist &&
					item.artist.toLowerCase().includes(query.toLowerCase())) ||
				(item.desc && item.desc.toLowerCase().includes(query.toLowerCase()));

			if (!matchesQuery) return false;

			const isActuallyInLibrary = isInLibrary(item) || item.pinned;

			if (!isActuallyInLibrary) return false;

			if (!filter) return true;
			if (filter === "Artists") return item.type === "artist";
			if (filter === "Albums") return item.type === "album";
			if (filter === "Playlists") return item.type === "mix";
			if (filter === "Pins")
				return (pinnedItems[item.title] ?? item.pinned) === true;
			if (filter === "Saves") return true;
			return true;
		},
	);

	const handleCreatePlaylist = () => {
		if (!newPlaylistName.trim()) return;

		const newPlaylist: MediaItem = {
			type: "mix",
			title: newPlaylistName.trim(),
			songs: 0,
			desc: "Parth Mital",
		};

		// Check if it already exists
		if (allItems.some((item) => item.title === newPlaylistName.trim())) {
			setCreateError("An item with this name already exists.");
			return;
		}

		addCustomPlaylist(newPlaylist);
		setNewPlaylistName("");
		setCreateError(null);
		closeCreateDialog();
		console.log("Created custom playlist:", newPlaylistName.trim());
	};

	const LIBRARY_COMPARATORS: Record<
		string,
		(a: MediaItem, b: MediaItem) => number
	> = {
		alphabetical: (a, b) => a.title.localeCompare(b.title),
		artist: (a, b) => {
			const artistA = a.artist || a.title;
			const artistB = b.artist || b.title;
			const cmp = artistA.localeCompare(artistB);
			return cmp !== 0 ? cmp : a.title.localeCompare(b.title);
		},
	};

	const { sortedItems, sortBy, sortOrder, setSortBy, setSortOrder } =
		useSorting({
			items: filteredItems,
			defaultSortKey: "recents",
			comparators: LIBRARY_COMPARATORS,
		});

	const finalItems = sortedItems
		.map((item) => ({
			...item,
			pinned: pinnedItems[item.title] ?? item.pinned,
		}))
		.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));

	return (
		<>
			<FilterBar
				isLibrary
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				sortBy={sortBy}
				onSortChange={setSortBy}
				onSearchChange={setSearchQuery}
				sortOrder={sortOrder}
				onSortOrderChange={setSortOrder}
				onAdd={() => openCreateDialog()}
			/>
			{!isInitialized ? (
				<div className="flex flex-col gap-2 opacity-50">
					<div className="p-4 text-white">Loading your library...</div>
				</div>
			) : viewMode === "grid" ? (
				<MediaGrid items={finalItems} />
			) : (
				<div className="flex flex-col gap-2">
					{finalItems.length > 0 ? (
						finalItems.map((item, index) => {
							const isPinned = item.pinned ?? false;
							const isCustom = customPlaylists.some(
								(cp) => cp.title === item.title,
							);

							const handleTogglePin = () => {
								const newPinnedState = !isPinned;
								togglePin(item.title, isPinned);
								console.log(
									`${newPinnedState ? "Pinned" : "Unpinned"}: ${item.title}`,
								);
							};

							return (
								<div
									key={index}
									className="group/row grid-cols-song-list-4 grid cursor-pointer items-center gap-6 rounded-lg px-4 py-2 hover:bg-neutral-900"
								>
									<div className="relative flex h-10 w-10 items-center justify-center">
										<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/row:opacity-100">
											<IconButton icon="Play Simple" alt="Play" noHover />
										</div>
										<span className="text-neutral-400 opacity-100 group-hover/row:opacity-0">
											{index + 1}
										</span>
									</div>

									<div className="min-w-0 flex-1">
										<TrackInfo
											image={item.imageUrl || ""}
											title={item.title}
											artist={
												item.type === "artist"
													? ""
													: item.artist || item.desc || ""
											}
										/>
									</div>

									<div className="text-neutral-400">
										{item.songs ? `${item.songs} songs` : ""}
									</div>

									<div className="pointer-events-none flex items-center gap-6 opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100">
										<ActionMenu
											trigger={<IconButton icon="More" alt="More" />}
											items={[
												{
													label: isPinned ? "Unpin" : "Pin",
													icon: "Pin",
													onClick: handleTogglePin,
												},
												...(item.type === "artist"
													? []
													: [
															{
																label: "Add to Queue",
																icon: "Add to Queue",
																onClick: () =>
																	console.log("Add to Queue", item.title),
															},
															{
																label: "Download",
																icon: "Download",
																onClick: () =>
																	console.log("Download", item.title),
															},
														]),
												{
													label: "Share",
													icon: "Share",
													onClick: () => console.log("Share", item.title),
												},
												{
													label: "Delete",
													icon: "Delete",
													onClick: () => {
														if (isCustom) {
															removeCustomPlaylist(item.title);
														} else {
															console.log("Delete", item.title);
														}
													},
													variant: "danger" as const,
												},
											]}
										/>
									</div>
								</div>
							);
						})
					) : (
						<div className="flex w-full flex-col items-center justify-center py-20 text-center">
							<p className="text-lg text-neutral-500">
								No library items found.
							</p>
							<p className="text-sm text-neutral-600">
								Add artists, albums, or playlists to your library to see them
								here.
							</p>
						</div>
					)}
				</div>
			)}

			<Dialog
				isOpen={isCreateDialogOpen}
				onClose={() => {
					closeCreateDialog();
					setNewPlaylistName("");
					setCreateError(null);
				}}
				title="Create New Playlist"
			>
				<div className="flex flex-col gap-6">
					<div className="flex flex-col gap-2">
						<label
							htmlFor="playlist-name"
							className="text-sm font-medium text-neutral-400"
						>
							Playlist Name
						</label>
						<input
							id="playlist-name"
							type="text"
							placeholder="My Awesome Playlist"
							value={newPlaylistName}
							onChange={(e) => {
								setNewPlaylistName(e.target.value);
								if (createError) setCreateError(null);
							}}
							onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
							autoFocus
							className={`w-full border bg-neutral-800 ${
								createError ? "border-red-500" : "border-neutral-700"
							} rounded-lg px-4 py-3 text-white transition-colors outline-none focus:border-white`}
						/>
						{createError && (
							<p className="mt-1 text-sm text-red-500">{createError}</p>
						)}
					</div>
					<div className="flex justify-end gap-3">
						<button
							onClick={() => {
								closeCreateDialog();
								setNewPlaylistName("");
							}}
							className="rounded-lg px-6 py-2 font-bold text-white transition-colors hover:bg-neutral-800"
						>
							Cancel
						</button>
						<button
							onClick={handleCreatePlaylist}
							disabled={!newPlaylistName.trim()}
							className="rounded-lg bg-white px-6 py-2 font-bold text-black transition-all hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Create
						</button>
					</div>
				</div>
			</Dialog>
		</>
	);
}

export default function LibraryPage() {
	return (
		<Suspense fallback={<LibrarySkeleton />}>
			<LibraryContentInner />
		</Suspense>
	);
}
