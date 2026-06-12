"use client";

import { useState } from "react";
import { IconButton } from "./ui/IconButton";
import { FilterPill } from "./ui/FilterPill";
import { SearchInput } from "./ui/SearchInput";
import { Dropdown } from "./ui/Dropdown";

interface FilterBarProps {
	isLibrary?: boolean;
	viewMode?: "list" | "grid";
	filters?: string[];
	activeFilter?: string;
	onFilterChange?: (filter: string) => void;
	onViewModeChange?: (mode: "list" | "grid") => void;
	hideViewModeToggle?: boolean;
	sortBy?: string;
	onSortChange?: (sort: string) => void;
	sortOptions?: { value: string; label: string }[];
	onSearchChange?: (query: string) => void;
	sortOrder?: "asc" | "desc";
	onSortOrderChange?: (order: "asc" | "desc") => void;
	onAdd?: () => void;
}

export function FilterBar({
	isLibrary = false,
	viewMode,
	filters = ["All", "Music"],
	activeFilter: controlledActiveFilter,
	onFilterChange,
	onViewModeChange,
	hideViewModeToggle = false,
	sortBy = "recents",
	onSortChange,
	sortOptions,
	onSearchChange,
	sortOrder = "asc",
	onSortOrderChange,
	onAdd,
}: FilterBarProps) {
	const [internalActiveFilter, setInternalActiveFilter] = useState(filters[0]);
	const [isSearchActive, setIsSearchActive] = useState(false);

	const activeFilter = controlledActiveFilter ?? internalActiveFilter;

	const handleFilterClick = (filter: string) => {
		if (onFilterChange) {
			onFilterChange(filter);
		}
		if (controlledActiveFilter === undefined) {
			setInternalActiveFilter(filter);
		}
	};

	const handleSortOrderToggle = () => {
		if (onSortOrderChange) {
			onSortOrderChange(sortOrder === "asc" ? "desc" : "asc");
		}
	};

	// Default sort options for library
	const defaultSortOptions = [
		{ value: "recents", label: "Recents" },
		{ value: "alphabetical", label: "Alphabetical" },
		{ value: "artist", label: "Artist" },
		{ value: "recently-added", label: "Recently Added" },
		{ value: "custom", label: "Custom Order" },
	];

	const activeSortOptions = sortOptions || defaultSortOptions;

	return (
		<div className="flex w-full items-center gap-3 whitespace-nowrap">
			{isLibrary ? (
				<>
					<div className="flex grow items-center gap-3">
						{!hideViewModeToggle && (
							<div className="flex items-center gap-3">
								<IconButton
									icon="List"
									alt="Line view"
									filled={viewMode === "list"}
									onClick={() => onViewModeChange?.("list")}
								/>
								<IconButton
									icon="Grid"
									alt="Grid view"
									filled={viewMode === "grid"}
									onClick={() => onViewModeChange?.("grid")}
								/>
							</div>
						)}
						<IconButton
							icon="Sort"
							alt="Sort"
							onClick={handleSortOrderToggle}
							filled={sortOrder === "desc"}
						/>
						<Dropdown
							options={activeSortOptions}
							value={sortBy}
							onChange={(value) => onSortChange?.(value)}
						/>
						{isSearchActive ? (
							<SearchInput
								autoFocus
								onClose={() => {
									setIsSearchActive(false);
									onSearchChange?.("");
								}}
								onChange={onSearchChange}
								preventNavigation={true}
							/>
						) : (
							<IconButton
								icon="Search"
								alt="Search"
								className="pl-1"
								onClick={() => setIsSearchActive(true)}
							/>
						)}
					</div>
					{onAdd && (
						<IconButton icon="Add" alt="Create Playlist" onClick={onAdd} />
					)}
				</>
			) : (
				<>
					<div className="scrollbar-hide flex items-center gap-3 overflow-x-auto">
						{filters.map((filter) => (
							<FilterPill
								key={filter}
								label={filter}
								active={activeFilter === filter}
								onClick={() => handleFilterClick(filter)}
							/>
						))}
					</div>
				</>
			)}
		</div>
	);
}
