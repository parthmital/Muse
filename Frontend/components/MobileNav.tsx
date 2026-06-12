"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconButton } from "./ui/IconButton";

const ITEMS = [
	{ label: "Home", icon: "Home", href: "/" },
	{ label: "Discover", icon: "Discover", href: "/discover" },
	{ label: "Search", icon: "Search", href: "/search" },
	{ label: "Library", icon: "Library", href: "/library" },
	{ label: "Me", icon: "User", href: "/profile" },
];

/**
 * Bottom tab bar — the primary navigation on small screens.
 * Hidden on md+ where the TopBar / Sidebar take over.
 */
export function MobileNav() {
	const pathname = usePathname();

	return (
		<nav
			aria-label="Primary"
			className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-neutral-800 bg-black pt-2 md:hidden"
			style={{
				paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)",
			}}
		>
			{ITEMS.map((item) => {
				const active =
					item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
				return (
					<Link
						key={item.label}
						href={item.href}
						aria-current={active ? "page" : undefined}
						className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
							active ? "text-white" : "text-neutral-500"
						}`}
					>
						<IconButton
							icon={item.icon}
							alt={item.label}
							filled={active}
							noHover
							className={active ? "brightness-0 invert" : ""}
						/>
						<span>{item.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
