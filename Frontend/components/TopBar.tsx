"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { NavItem } from "./ui/NavItem";
import { IconButton } from "./ui/IconButton";
import { SearchInput } from "./ui/SearchInput";
import { Suspense } from "react";
import { TopBarSkeleton } from "./ui/Skeletons";

const MAIN_NAV = [
	{
		label: "My Library",
		icon: "Library",
		href: "/library",
	},
	{
		label: "Home",
		icon: "Home",
		href: "/",
	},
	{
		label: "Discover",
		icon: "Discover",
		href: "/discover",
	},
	{
		label: "Search",
		icon: "Search",
		href: "/search",
	},
];

const USER_NAV = [
	{
		icon: "Settings",
		alt: "Settings",
		href: "/settings",
	},
	{
		icon: "User",
		alt: "User",
		href: "/profile",
	},
];

function TopBarContent() {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const isSearch = pathname === "/search";

	return (
		<div className="flex items-center justify-between gap-4 whitespace-nowrap">
			{/* Mobile: brand or search input (nav lives in the bottom MobileNav) */}
			<div className="flex grow items-center gap-4 md:hidden">
				{isSearch ? (
					<SearchInput autoFocus />
				) : (
					<span className="text-lg font-black tracking-tight text-white">
						Muse
					</span>
				)}
			</div>

			{/* Desktop: full primary nav */}
			<div className="hidden grow items-center gap-4 md:flex">
				{MAIN_NAV.map((item) => {
					if (item.label === "Search" && isSearch) {
						return <SearchInput key="search-input" autoFocus />;
					}

					const isActive =
						item.href === "/library"
							? pathname === "/library" && !searchParams.get("filter")
							: pathname === item.href;

					return (
						<NavItem
							key={item.label}
							label={item.label}
							icon={item.icon}
							href={item.href}
							active={isActive}
							className={`min-w-15 ${item.label === "Search" ? "grow" : ""}`}
						/>
					);
				})}
			</div>
			<div className="flex gap-2">
				{USER_NAV.map((item) => (
					<IconButton
						key={item.alt}
						icon={item.icon}
						alt={item.alt}
						ariaLabel={item.alt}
						href={item.href}
					/>
				))}
			</div>
		</div>
	);
}

export function TopBar() {
	return (
		<Suspense fallback={<TopBarSkeleton />}>
			<TopBarContent />
		</Suspense>
	);
}
