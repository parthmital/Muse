"use client";

interface FilterPillProps {
	label: string;
	active?: boolean;
	onClick?: () => void;
}

export function FilterPill({ label, active, onClick }: FilterPillProps) {
	return (
		<div
			onClick={onClick}
			className={`cursor-pointer rounded-lg px-4 py-2 ${
				active
					? "bg-white font-bold text-black"
					: "rounded-lg border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800"
			}`}
		>
			{label}
		</div>
	);
}
