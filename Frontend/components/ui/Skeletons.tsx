"use client";

import { Skeleton } from "./Skeleton";

// ── Layout Skeletons ────────────────────────────────────────────────────────

export function TopBarSkeleton() {
	return (
		<div className="flex h-[44px] items-center justify-between gap-4 whitespace-nowrap">
			<div className="flex grow items-center gap-4">
				{[1, 2, 3, 4].map((i) => (
					<Skeleton key={i} className={`h-11 ${i === 4 ? "grow" : "w-32"}`} />
				))}
			</div>
			<div className="flex gap-2">
				{[1, 2].map((i) => (
					<Skeleton key={i} className="h-11 w-11 rounded-full" />
				))}
			</div>
		</div>
	);
}

export function SidebarSkeleton() {
	return (
		<div className="flex h-full min-w-15 shrink-0 flex-col gap-3 rounded-lg border border-neutral-800 p-4 whitespace-nowrap">
			{[1, 2, 3, 4, 5, 6].map((i) => (
				<Skeleton key={i} className="h-11 w-full" />
			))}
		</div>
	);
}

export function SearchInputSkeleton() {
	return (
		<div className="flex h-11 grow items-center gap-2 rounded-lg bg-neutral-900 pr-4 pl-1">
			<Skeleton className="h-11 w-11 rounded-full" />
			<Skeleton className="h-4 grow bg-neutral-800/50" />
		</div>
	);
}

// ── Card Skeletons ──────────────────────────────────────────────────────────

export function MediaCardSkeleton({
	type = "album",
}: {
	type?: "artist" | "album" | "mix";
}) {
	return (
		<div className="flex w-44 shrink-0 flex-col gap-2">
			<Skeleton
				className={`aspect-square w-full ${type === "artist" ? "rounded-full" : "rounded-lg"}`}
			/>
			<Skeleton className="h-4 w-3/4 rounded-md" />
			{type !== "artist" && (
				<Skeleton className="h-3 w-1/2 rounded-md opacity-50" />
			)}
		</div>
	);
}

// ── Song Row Skeleton ───────────────────────────────────────────────────────

export function SongRowSkeleton({
	hideAlbum = false,
}: {
	hideAlbum?: boolean;
}) {
	return (
		<div
			className={`grid items-center gap-6 px-4 py-2 ${hideAlbum ? "grid-cols-song-list-5" : "grid-cols-song-list-6"}`}
		>
			{/* Index */}
			<Skeleton className="h-4 w-6 rounded" />
			{/* Track info */}
			<div className="flex items-center gap-3">
				<Skeleton className="h-10 w-10 shrink-0 rounded" />
				<div className="flex min-w-0 flex-col gap-1.5">
					<Skeleton className="h-3.5 w-32 rounded" />
					<Skeleton className="h-3 w-20 rounded opacity-60" />
				</div>
			</div>
			{/* Album */}
			{!hideAlbum && <Skeleton className="h-3.5 w-24 rounded" />}
			{/* Duration */}
			<Skeleton className="h-3.5 w-10 rounded" />
			{/* Like */}
			<Skeleton className="mx-auto h-5 w-5 rounded-full" />
			{/* Actions */}
			<div className="flex items-center gap-4">
				<Skeleton className="h-5 w-5 rounded-full opacity-0" />
				<Skeleton className="h-5 w-5 rounded-full opacity-0" />
			</div>
		</div>
	);
}

export function SongListSkeleton({
	count = 8,
	hideAlbum = false,
}: {
	count?: number;
	hideAlbum?: boolean;
}) {
	return (
		<div className="flex flex-col">
			{/* Header */}
			<div
				className={`grid items-center gap-6 border-b border-neutral-800 px-4 py-2 ${hideAlbum ? "grid-cols-song-list-5" : "grid-cols-song-list-6"}`}
			>
				<Skeleton className="h-3 w-4 rounded" />
				<Skeleton className="h-3 w-16 rounded" />
				{!hideAlbum && <Skeleton className="h-3 w-16 rounded" />}
				<Skeleton className="h-3 w-12 rounded" />
				<div />
				<div />
			</div>
			{Array.from({ length: count }, (_, i) => (
				<SongRowSkeleton key={i} hideAlbum={hideAlbum} />
			))}
		</div>
	);
}

// ── Shelf Skeleton ──────────────────────────────────────────────────────────

export function MediaShelfSkeleton() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<Skeleton className="h-7 w-40 rounded-md" />
				<div className="flex gap-2">
					<Skeleton className="h-7 w-7 rounded-full" />
					<Skeleton className="h-7 w-7 rounded-full" />
				</div>
			</div>
			<div className="flex gap-4 overflow-hidden">
				{Array.from({ length: 6 }, (_, i) => (
					<MediaCardSkeleton key={i} />
				))}
			</div>
		</div>
	);
}

// ── Page Skeletons ──────────────────────────────────────────────────────────

export function HomePageSkeleton() {
	return (
		<div className="flex flex-col gap-8 p-2">
			{[1, 2, 3].map((i) => (
				<MediaShelfSkeleton key={i} />
			))}
		</div>
	);
}

export function AlbumPageSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div className="flex gap-6">
				<Skeleton className="h-56 w-56 shrink-0 rounded-lg" />
				<div className="flex flex-col justify-end gap-3">
					<Skeleton className="h-3 w-16 rounded" />
					<Skeleton className="h-10 w-72 rounded-lg" />
					<div className="flex items-center gap-3">
						<Skeleton className="h-8 w-8 rounded-full" />
						<Skeleton className="h-4 w-32 rounded" />
						<Skeleton className="h-4 w-20 rounded" />
					</div>
					<div className="flex gap-3">
						<Skeleton className="h-10 w-10 rounded-full" />
						<Skeleton className="h-10 w-10 rounded-full" />
						<Skeleton className="h-10 w-10 rounded-full" />
					</div>
				</div>
			</div>
			<SongListSkeleton count={10} hideAlbum />
		</div>
	);
}

export function ArtistPageSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			{/* Banner */}
			<Skeleton className="h-64 w-full rounded-xl" />
			{/* Tabs */}
			<div className="flex gap-6">
				{[1, 2, 3, 4].map((i) => (
					<Skeleton key={i} className="h-8 w-20 rounded-full" />
				))}
			</div>
			{/* Top tracks */}
			<SongListSkeleton count={5} />
			{/* Albums grid */}
			<MediaGridSkeleton />
		</div>
	);
}

export function PlaylistPageSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex gap-6">
				<Skeleton className="h-48 w-48 shrink-0 rounded-lg" />
				<div className="flex flex-col justify-end gap-3">
					<Skeleton className="h-3 w-16 rounded" />
					<Skeleton className="h-8 w-64 rounded-lg" />
					<Skeleton className="h-4 w-40 rounded" />
					<div className="flex gap-3">
						<Skeleton className="h-10 w-10 rounded-full" />
						<Skeleton className="h-10 w-10 rounded-full" />
					</div>
				</div>
			</div>
			<SongListSkeleton count={12} />
		</div>
	);
}

export function PlayerSkeleton() {
	return (
		<div className="flex shrink-0 items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2">
			<div className="flex grow items-center gap-2">
				{[1, 2, 3, 4, 5].map((i) => (
					<Skeleton key={i} className="h-8 w-8 rounded-full" />
				))}
				<div className="flex grow items-center gap-4">
					<Skeleton className="h-3 w-8 rounded" />
					<Skeleton className="h-1 grow rounded-lg" />
					<Skeleton className="h-3 w-8 rounded" />
				</div>
				<Skeleton className="h-8 w-8 rounded-full" />
				<div className="flex grow items-center gap-3">
					<Skeleton className="h-10 w-10 shrink-0 rounded" />
					<div className="flex flex-col gap-1">
						<Skeleton className="h-3.5 w-28 rounded" />
						<Skeleton className="h-3 w-20 rounded opacity-60" />
					</div>
				</div>
			</div>
			<div className="flex gap-2">
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-8 w-8 rounded-full" />
				))}
			</div>
		</div>
	);
}

// ── Composite Skeletons ─────────────────────────────────────────────────────

export function MediaGridSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
			{Array.from({ length: 12 }, (_, i) => (
				<MediaCardSkeleton key={i} />
			))}
		</div>
	);
}

export function FilterBarSkeleton() {
	return (
		<div className="flex items-center justify-between gap-4 py-2">
			<div className="flex items-center gap-2">
				{[1, 2, 3, 4, 5].map((i) => (
					<Skeleton key={i} className="h-9 w-20 rounded-full" />
				))}
			</div>
			<div className="flex items-center gap-2">
				<Skeleton className="h-9 w-9 rounded-full" />
				<Skeleton className="h-9 w-9 rounded-full" />
			</div>
		</div>
	);
}

export function LibrarySkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<FilterBarSkeleton />
			<MediaGridSkeleton />
		</div>
	);
}

export function SearchSkeleton() {
	return (
		<div className="flex flex-col gap-8">
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-48 rounded-md" />
					<div className="flex gap-2">
						<Skeleton className="h-8 w-8 rounded-full" />
						<Skeleton className="h-8 w-8 rounded-full" />
					</div>
				</div>
				<div className="grid grid-cols-2 gap-6 overflow-hidden md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<MediaCardSkeleton key={i} />
					))}
				</div>
			</div>

			<div className="flex flex-col gap-6">
				<Skeleton className="h-8 w-32 rounded-md" />
				{[1, 2, 3].map((section) => (
					<div key={section} className="flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<Skeleton className="h-6 w-32 rounded-md" />
							<div className="flex gap-2">
								<Skeleton className="h-6 w-6 rounded-full" />
								<Skeleton className="h-6 w-6 rounded-full" />
							</div>
						</div>
						<div className="flex gap-4 overflow-hidden pb-2">
							{[1, 2, 3, 4, 5, 6].map((i) => (
								<Skeleton
									key={i}
									className="h-28 min-w-[200px] flex-shrink-0 rounded-xl"
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
