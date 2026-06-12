"use client";

import { useState, useRef, useEffect } from "react";

interface DropdownOption {
	value: string;
	label: string;
}

interface DropdownProps {
	options: DropdownOption[];
	value: string;
	onChange: (value: string) => void;
	className?: string;
	align?: "left" | "right";
}

export function Dropdown({
	options,
	value,
	onChange,
	className = "",
	align = "left",
}: DropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const selectedOption = options.find((opt) => opt.value === value);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen]);

	return (
		<div ref={dropdownRef} className={`relative ${className}`}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 whitespace-nowrap hover:bg-neutral-800"
			>
				<span className="text-sm font-medium">{selectedOption?.label}</span>
				<svg
					className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>

			{isOpen && (
				<div
					className={`absolute top-full z-50 mt-1 flex min-w-full flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-1 whitespace-nowrap shadow-lg ${
						align === "right" ? "right-0" : "left-0"
					}`}
				>
					{options.map((option) => (
						<button
							key={option.value}
							onClick={() => {
								onChange(option.value);
								setIsOpen(false);
							}}
							className={`w-full rounded-lg px-4 py-2 text-left text-sm whitespace-nowrap hover:bg-neutral-800 ${
								option.value === value
									? "font-medium text-green-500"
									: "text-neutral-400"
							}`}
						>
							{option.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
