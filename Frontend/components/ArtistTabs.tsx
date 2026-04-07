"use client";

import { IconButton } from "@/components/ui/IconButton";
import { SearchInput } from "@/components/ui/SearchInput";

interface ArtistTabsProps {
	tabs: string[];
	activeTab: string;
	onTabChange: (tab: string) => void;
	isSearchActive: boolean;
	setIsSearchActive: (active: boolean) => void;
	viewMode: "Grid" | "List";
	onViewModeChange: (mode: "Grid" | "List") => void;
	onSearchChange?: (query: string) => void;
}

export function ArtistTabs({
	tabs,
	activeTab,
	onTabChange,
	isSearchActive,
	setIsSearchActive,
	viewMode,
	onViewModeChange,
	onSearchChange,
}: ArtistTabsProps) {
	return (
		<div className="flex items-center gap-6 border-b border-neutral-800 px-6 py-2">
			<div className="scrollbar-hide flex items-center gap-8 overflow-x-auto">
				{tabs.map((tab) => (
					<button
						key={tab}
						onClick={() => onTabChange(tab)}
						className={
							activeTab === tab
								? "text-white"
								: "text-neutral-500 hover:text-neutral-300"
						}
					>
						{tab}
					</button>
				))}
			</div>
			{!isSearchActive && <div className="grow" />}
			<div
				className={`flex items-center gap-3 ${isSearchActive ? "flex-1" : ""}`}
			>
				<div
					className={
						isSearchActive ? "flex-1" : "flex items-center justify-end"
					}
				>
					{isSearchActive ? (
						<SearchInput
							autoFocus
							onClose={() => {
								setIsSearchActive(false);
								onSearchChange?.("");
							}}
							onSearch={onSearchChange}
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

				{["Albums", "Singles and EPs"].includes(activeTab) && (
					<div className="flex items-center gap-3">
						<IconButton
							icon="Grid"
							alt="Grid View"
							filled={viewMode === "Grid"}
							onClick={() => onViewModeChange("Grid")}
						/>
						<IconButton
							icon="List"
							alt="List View"
							filled={viewMode === "List"}
							onClick={() => onViewModeChange("List")}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
