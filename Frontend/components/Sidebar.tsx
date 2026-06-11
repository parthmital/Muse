"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { NavItem } from "./ui/NavItem";
import { Suspense } from "react";
import { SidebarSkeleton } from "./ui/Skeletons";

const NAV_ITEMS = [
	{
		label: "Pins",
		icon: "Pin",
		href: "/library?filter=Pins",
	},
	{
		label: "Playlists",
		icon: "Playlist",
		href: "/library?filter=Playlists",
	},
	{
		label: "Liked Songs",
		icon: "Like",
		href: "/liked",
	},
	{
		label: "Saves",
		icon: "Save",
		href: "/library?filter=Saves",
	},
	{
		label: "Albums",
		icon: "Album",
		href: "/library?filter=Albums",
	},
	{
		label: "Artists",
		icon: "Artist",
		href: "/library?filter=Artists",
	},
];

function SidebarContent() {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	return (
		<div className="hidden min-w-15 shrink-0 flex-col gap-3 rounded-lg border border-neutral-800 p-4 whitespace-nowrap md:flex">
			{NAV_ITEMS.map((item) => {
				let isActive = false;
				if (item.href.startsWith("/library?filter=")) {
					const filterParam = item.href.split("=")[1];
					isActive =
						pathname === "/library" &&
						searchParams.get("filter") === filterParam;
				} else {
					isActive = pathname === item.href;
				}

				return (
					<NavItem
						key={item.label}
						label={item.label}
						icon={item.icon}
						href={item.href}
						active={isActive}
					/>
				);
			})}
		</div>
	);
}

export function Sidebar() {
	return (
		<Suspense fallback={<SidebarSkeleton />}>
			<SidebarContent />
		</Suspense>
	);
}
