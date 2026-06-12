"use client";

import { IconButton } from "@/components/ui/IconButton";
import { GRID_COLUMNS_WITH_ALBUM, GRID_COLUMNS_WITHOUT_ALBUM } from "./SongRow";

interface SongListHeaderProps {
	hideAlbum?: boolean;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
	onSort?: (key: string) => void;
}

const SortIcon = ({
	active,
	sortOrder,
}: {
	active: boolean;
	sortOrder?: "asc" | "desc";
}) => {
	return (
		<svg
			className={`h-4 w-4 transition-all ${
				active && sortOrder === "asc" ? "rotate-180" : ""
			} ${
				active
					? "text-green-500 opacity-100"
					: "text-neutral-500 opacity-0 group-hover/header:opacity-100"
			}`}
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			viewBox="0 0 24 24"
		>
			<path d="M19 9l-7 7-7-7" />
		</svg>
	);
};

const HeaderItem = ({
	label,
	sortKey,
	className = "",
	sortBy,
	sortOrder,
	onSort,
}: {
	label: string;
	sortKey?: string;
	className?: string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
	onSort?: (key: string) => void;
}) => {
	const active = sortBy === sortKey;
	const canSort = !!onSort && !!sortKey;

	return (
		<div
			className={`group/header flex items-center gap-1 ${canSort ? "cursor-pointer select-none" : ""} ${className}`}
			onClick={() => canSort && onSort(sortKey)}
		>
			<span
				className={`text-xs font-bold tracking-widest uppercase transition-colors ${
					active
						? "text-green-500"
						: "text-neutral-500 group-hover/header:text-white"
				}`}
			>
				{label}
			</span>
			{canSort && <SortIcon active={active} sortOrder={sortOrder} />}
		</div>
	);
};

export function SongListHeader({
	hideAlbum = false,
	sortBy,
	sortOrder,
	onSort,
}: SongListHeaderProps) {
	const gridClass = hideAlbum
		? GRID_COLUMNS_WITHOUT_ALBUM
		: GRID_COLUMNS_WITH_ALBUM;

	return (
		<div
			className={`hidden items-center gap-6 border-b border-neutral-800 px-4 pb-2 md:grid ${gridClass}`}
		>
			<div className="text-center text-xs font-bold tracking-widest text-neutral-500 uppercase">
				#
			</div>
			<HeaderItem
				label="Title"
				sortKey="title"
				sortBy={sortBy}
				sortOrder={sortOrder}
				onSort={onSort}
			/>
			{!hideAlbum && (
				<HeaderItem
					label="Album"
					sortKey="album"
					sortBy={sortBy}
					sortOrder={sortOrder}
					onSort={onSort}
				/>
			)}
			<HeaderItem
				label="Duration"
				sortKey="duration"
				sortBy={sortBy}
				sortOrder={sortOrder}
				onSort={onSort}
			/>
			<div className="invisible">
				<IconButton icon="Like" alt="" />
			</div>
			<div className="invisible flex gap-6">
				<IconButton icon="Add to Playlist" alt="" />
				<IconButton icon="More" alt="" />
				<IconButton icon="Check" alt="" />
			</div>
		</div>
	);
}
