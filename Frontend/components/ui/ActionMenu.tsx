"use client";

import {
	useState,
	useRef,
	useEffect,
	ReactNode,
	useLayoutEffect,
	useCallback,
	useId,
} from "react";
import Image from "next/image";
import { SearchInput } from "./SearchInput";
import { useActionMenu } from "@/context/ActionMenuContext";

export interface ActionMenuItem {
	label?: string;
	icon?: string;
	onClick?: () => void;
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
	onTrigger?: () => void;
	openOnClick?: boolean;
	onOpenChange?: (isOpen: boolean) => void;
}

export function ActionMenu({
	trigger,
	items,
	align = "right",
	className = "",
	placement = "bottom",
	showSearch = false,
	showCheckmarks = false,
	onTrigger,
	openOnClick = true,
	onOpenChange,
}: ActionMenuProps) {
	const menuId = useId();
	const { openMenu, closeMenu, isMenuOpen } = useActionMenu();
	const isOpen = isMenuOpen(menuId);
	const [searchQuery, setSearchQuery] = useState("");
	const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const initialCoordsRef = useRef<{ x: number; y: number } | null>(null);

	useEffect(() => {
		onOpenChange?.(isOpen);
	}, [isOpen, onOpenChange]);

	useEffect(() => {
		if (isOpen && onTrigger) {
			onTrigger();
		}
	}, [isOpen, onTrigger]);

	const filteredItems = items.filter((item) => {
		if (!item.label) return false;
		return item.label.toLowerCase().includes(searchQuery.toLowerCase());
	});

	const updatePosition = useCallback(() => {
		if (!contentRef.current) return;

		const contentRect = contentRef.current.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const gap = 4;
		const padding = 12;

		let x = initialCoordsRef.current?.x ?? 0;
		let y = initialCoordsRef.current?.y ?? 0;

		// If we have a trigger reference and no explicit coords (click trigger), position relative to trigger
		if (triggerRef.current && !initialCoordsRef.current) {
			const triggerRect = triggerRef.current.getBoundingClientRect();

			const spaces = {
				top: triggerRect.top - gap,
				bottom: vh - triggerRect.bottom - gap,
				left: triggerRect.left - gap,
				right: vw - triggerRect.right - gap,
			};

			let bestPlacement: NonNullable<ActionMenuProps["placement"]> = placement;

			const fits = (p: NonNullable<ActionMenuProps["placement"]>) =>
				spaces[p] >=
				(p === "top" || p === "bottom"
					? contentRect.height
					: contentRect.width);

			if (!fits(bestPlacement)) {
				const sortedSpaces = Object.entries(spaces).sort((a, b) => b[1] - a[1]);
				bestPlacement = sortedSpaces[0][0] as NonNullable<
					ActionMenuProps["placement"]
				>;
			}

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
		}

		// Clamp to viewport
		x = Math.max(padding, Math.min(x, vw - contentRect.width - padding));
		y = Math.max(padding, Math.min(y, vh - contentRect.height - padding));

		setCoords({ x, y });
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
				closeMenu();
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen, closeMenu]);

	// Handle context menu (right-click)
	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		// Open menu at cursor position
		initialCoordsRef.current = { x: e.clientX, y: e.clientY };
		openMenu(menuId);
		setSearchQuery("");
	};

	// Handle click on trigger
	const handleTriggerClick = (e: React.MouseEvent) => {
		if (!openOnClick) return;
		e.stopPropagation();

		if (isOpen) {
			closeMenu();
		} else {
			// Position will be calculated from trigger ref
			initialCoordsRef.current = null;
			openMenu(menuId);
			setSearchQuery("");
		}
	};

	// Handle mouse enter/leave for hover behavior
	const handleMouseEnter = () => {
		// Keep menu open when hovering over wrapper
	};

	const handleMouseLeave = () => {
		// Close menu when hovering away from the wrapper
		if (isOpen) {
			closeMenu();
		}
	};

	return (
		<div
			ref={wrapperRef}
			className={`relative inline-block ${className}`}
			onContextMenu={handleContextMenu}
			onMouseLeave={handleMouseLeave}
		>
			<div
				ref={triggerRef}
				onClick={handleTriggerClick}
				className={openOnClick ? "cursor-pointer" : ""}
				onMouseEnter={handleMouseEnter}
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
						opacity: coords ? 1 : 0,
						visibility: coords ? "visible" : "hidden",
						pointerEvents: coords ? "auto" : "none",
						zIndex: 50,
						transition: "none",
					}}
					className="animate-in fade-in zoom-in-95 flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-1 whitespace-nowrap shadow-lg duration-100"
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
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
					{filteredItems.map((item, index) => {
						return (
							<button
								key={`${item.label}-${index}`}
								onClick={(e) => {
									e.stopPropagation();
									item.onClick?.();
									if (!showCheckmarks || item.checked === undefined) {
										closeMenu();
									}
								}}
								className={`flex w-full items-center gap-2 ${
									showCheckmarks && item.checked !== undefined ? "" : "pr-3"
								} group cursor-pointer rounded-md text-left text-sm whitespace-nowrap transition-colors hover:bg-neutral-800`}
							>
								{item.icon && item.icon !== "undefined" && (
									<Image
										src={`/icons/Name=${item.icon}, Filled=${
											item.checked ? "Yes" : "No"
										}.svg`}
										alt=""
										width={40}
										height={40}
										className={`shrink-0 ${
											item.checked && item.variant !== "danger"
												? "brightness-0 invert"
												: ""
										}`}
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
						);
					})}
				</div>
			)}
		</div>
	);
}
