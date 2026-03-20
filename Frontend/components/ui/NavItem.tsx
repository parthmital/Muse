import Link from "next/link";
import { IconButton } from "./IconButton";

interface NavItemProps {
	label?: string;
	icon: string;
	className?: string;
	active?: boolean;
	href?: string;
}

export function NavItem({
	label,
	icon,
	className = "",
	active = false,
	href = "/",
}: NavItemProps) {
	const classes = [
		"group flex items-center gap-2 rounded-lg pr-4 pl-1 cursor-pointer no-underline text-inherit",
		active ? "bg-neutral-900 text-white" : "hover:text-white",
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<Link href={href} className={classes}>
			<IconButton
				icon={icon}
				alt={label || icon}
				filled={active}
				className={
					active
						? "brightness-0 invert"
						: "group-hover:brightness-0 group-hover:invert"
				}
			/>
			{label && <span>{label}</span>}
		</Link>
	);
}
