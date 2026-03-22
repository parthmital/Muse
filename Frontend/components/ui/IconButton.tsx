"use client";

import Image from "next/image";
import Link from "next/link";

// Icons that have filled versions available
const ICONS_WITH_FILLED_VERSIONS = new Set([
	"Check",
	"Discover",
	"Friends",
	"Home",
	"Library",
	"Like",
	"Notes",
	"Pin",
	"Save",
	"Search",
	"Show",
	"Synced Lyrics",
	"Timer",
	"Translate",
	"User",
]);

// Icons that should not be inverted (usually because they have their own colors like green)
const SPECIAL_ICONS: Record<string, string> = {
	Play: "No",
	Pause: "No",
	Check: "Yes",
	Notes: "Yes",
	Pin: "Yes",
	Private: "No-1",
	Video: "No",
	"Synced Lyrics": "Yes",
	Translate: "Yes",
};

interface IconButtonProps {
	icon: string;
	alt: string;
	width?: number;
	height?: number;
	className?: string;
	filled?: boolean;
	href?: string;
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
	disabled?: boolean;
	noHover?: boolean;
}

export function IconButton({
	icon,
	alt,
	width = 40,
	height = 40,
	className = "",
	filled = false,
	href,
	onClick,
	disabled = false,
	noHover = false,
}: IconButtonProps) {
	if (!icon || icon === "undefined") return null;

	// Only use filled version if it exists for this icon
	const useFilled = filled && ICONS_WITH_FILLED_VERSIONS.has(icon);
	let filledValue = useFilled ? "Yes" : "No";

	// Handle special cases for filenames
	if (icon === "Private" && !useFilled) {
		filledValue = "No-1";
	}

	const src = `/icons/Name=${icon}, Filled=${filledValue}.svg`;

	const isSpecialIcon = SPECIAL_ICONS[icon] === filledValue;
	const shouldInvert = !noHover && !disabled && !isSpecialIcon;

	const classes = [
		"group flex items-center justify-center border-none cursor-pointer outline-none focus:outline-none",
		disabled && "opacity-50 cursor-default",
		className,
	]
		.filter(Boolean)
		.join(" ");

	const imageClasses = [
		filled && !isSpecialIcon && "brightness-0 invert",
		shouldInvert && "group-hover:brightness-0 group-hover:invert",
	]
		.filter(Boolean)
		.join(" ");

	const content = (
		<Image
			src={src}
			alt={alt}
			width={width}
			height={height}
			className={imageClasses}
		/>
	);

	if (href && !disabled) {
		return (
			<Link href={href} className={classes} title={alt}>
				{content}
			</Link>
		);
	}

	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={classes}
			title={alt}
		>
			{content}
		</button>
	);
}
