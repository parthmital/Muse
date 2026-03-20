"use client";

import {
	useState,
	useRef,
	useEffect,
	ReactNode,
	useLayoutEffect,
	useCallback,
} from "react";
import Image from "next/image";
import { SearchInput } from "./SearchInput";

export interface ActionMenuItem {
	label: string;
	icon?: string;
	onClick: () => void;
	variant?: "default" | "danger";
	checked?: boolean;
}

interface ActionMenuProps {
	trigger: ReactNode;
	items: ActionMenuItem[];
	align?: "left" | "right";
	className?: string;
	placement?: "top" | "bottom" | "left" | "right";
	showSearch?: boolean;
	showCheckmarks?: boolean;
}

export function ActionMenu({
	trigger,
	items,
	align = "right",
	className = "",
	placement = "bottom",
	showSearch = false,
	showCheckmarks = false,
}: ActionMenuProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
	const [minWidth, setMinWidth] = useState(0);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	const filteredItems = items.filter((item) =>
		item.label.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const updatePosition = useCallback(() => {
		if (triggerRef.current && contentRef.current) {
			const triggerRect = triggerRef.current.getBoundingClientRect();
			const contentRect = contentRef.current.getBoundingClientRect();
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const gap = 4;
			const padding = 12;

			setMinWidth(triggerRect.width);

			const spaces = {
				top: triggerRect.top - gap,
				bottom: vh - triggerRect.bottom - gap,
				left: triggerRect.left - gap,
				right: vw - triggerRect.right - gap,
			};

			let bestPlacement: NonNullable<ActionMenuProps["placement"]> = placement;

			const fits = (p: NonNullable<ActionMenuProps["placement"]>) => {
				if (p === "top" || p === "bottom")
					return spaces[p] >= contentRect.height;
				return spaces[p] >= contentRect.width;
			};

			if (!fits(bestPlacement)) {
				const sortedSpaces = Object.entries(spaces).sort((a, b) => b[1] - a[1]);
				bestPlacement = sortedSpaces[0][0] as NonNullable<
					ActionMenuProps["placement"]
				>;
			}

			let x = 0;
			let y = 0;

			if (bestPlacement === "bottom" || bestPlacement === "top") {
				x =
					align === "right"
						? triggerRect.right - contentRect.width
						: triggerRect.left;
				y =
					bestPlacement === "bottom"
						? triggerRect.bottom + gap
						: triggerRect.top - contentRect.height - gap;
			} else {
				x =
					bestPlacement === "right"
						? triggerRect.right + gap
						: triggerRect.left - contentRect.width - gap;
				y = triggerRect.top;
			}

			// Clamp to viewport
			x = Math.max(padding, Math.min(x, vw - contentRect.width - padding));
			y = Math.max(padding, Math.min(y, vh - contentRect.height - padding));

			setCoords({ x, y });
		}
	}, [align, placement]);

	useLayoutEffect(() => {
		if (isOpen) {
			updatePosition();

			const handleUpdate = () => updatePosition();
			window.addEventListener("scroll", handleUpdate, true);
			window.addEventListener("resize", handleUpdate);

			return () => {
				window.removeEventListener("scroll", handleUpdate, true);
				window.removeEventListener("resize", handleUpdate);
			};
		}
	}, [isOpen, updatePosition]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				wrapperRef.current &&
				!wrapperRef.current.contains(event.target as Node)
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
		<div ref={wrapperRef} className={`relative inline-block ${className}`}>
			<div
				ref={triggerRef}
				onClick={(e) => {
					e.stopPropagation();
					if (!isOpen) {
						setCoords(null);
						setSearchQuery("");
					}
					setIsOpen(!isOpen);
				}}
				className="cursor-pointer"
			>
				{trigger}
			</div>

			{isOpen && (
				<div
					ref={contentRef}
					style={{
						position: "fixed",
						top: coords?.y ?? 0,
						left: coords?.x ?? 0,
						minWidth: minWidth,
						opacity: coords ? 1 : 0,
						visibility: coords ? "visible" : "hidden",
						pointerEvents: coords ? "auto" : "none",
						zIndex: 50,
						transition: "none", // Prevent smooth sliding/dragging during scroll or opening
					}}
					className="animate-in fade-in zoom-in-95 flex min-w-full flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-1 whitespace-nowrap shadow-lg duration-100"
				>
					{showSearch && (
						<div className="mb-1" onClick={(e) => e.stopPropagation()}>
							<SearchInput
								placeholder="Filter..."
								autoFocus
								preventNavigation
								onChange={setSearchQuery}
								className="h-10! gap-2! rounded-md! bg-neutral-800/50! pr-3! pl-0!"
							/>
						</div>
					)}
					{filteredItems.map((item, index) => (
						<button
							key={`${item.label}-${index}`}
							onClick={(e) => {
								e.stopPropagation();
								item.onClick();
								if (!showCheckmarks || item.checked === undefined) {
									setIsOpen(false);
								}
							}}
							className={`flex w-full items-center gap-2 ${
								showCheckmarks && item.checked !== undefined ? "" : "pr-3"
							} group cursor-pointer rounded-md text-left text-sm whitespace-nowrap transition-colors hover:bg-neutral-800`}
						>
							{item.icon && (
								<Image
									src={`/icons/Name=${item.icon}, Filled=No.svg`}
									alt=""
									width={40}
									height={40}
									className="shrink-0"
								/>
							)}
							<span
								className={`flex-1 font-medium ${
									item.variant === "danger"
										? "text-red-500"
										: "text-neutral-300 group-hover:text-white"
								}`}
							>
								{item.label}
							</span>
							{showCheckmarks && item.checked !== undefined && (
								<Image
									src={
										item.checked
											? "/icons/Name=Check, Filled=Yes.svg"
											: "/icons/Name=Check, Filled=No.svg"
									}
									alt={item.checked ? "Checked" : "Unchecked"}
									width={40}
									height={40}
									className="shrink-0 opacity-100 transition-opacity"
								/>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
