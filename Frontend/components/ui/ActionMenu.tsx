"use client";

import {
	useState,
	useRef,
	useEffect,
	ReactNode,
	useLayoutEffect,
	useCallback,
	useId,
	useContext,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { SearchInput } from "./SearchInput";
import { useActionMenu } from "@/context/ActionMenuContext";
import { PageContainerContext } from "./PageContainer";

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
	containerRef?: React.RefObject<HTMLElement | null>;
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
	containerRef,
}: ActionMenuProps) {
	const menuId = useId();
	const { openMenu, closeMenu, isMenuOpen } = useActionMenu();
	const isOpen = isMenuOpen(menuId);
	const [searchQuery, setSearchQuery] = useState("");
	const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
	const [menuBounds, setMenuBounds] = useState<{
		maxWidth?: number;
		maxHeight?: number;
	}>({});
	const [isPositioned, setIsPositioned] = useState(false);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const initialCoordsRef = useRef<{ x: number; y: number } | null>(null);
	const revealTimeoutRef = useRef<number | null>(null);

	// Use explicit containerRef prop, or fall back to PageContainerContext
	const pageContainerContext = useContext(PageContainerContext);
	const effectiveContainerRef =
		containerRef ?? pageContainerContext?.containerRef;

	const resolveBoundsContainer = useCallback((): HTMLElement | null => {
		if (effectiveContainerRef?.current) {
			return effectiveContainerRef.current;
		}

		const nearestContainer = triggerRef.current?.closest(
			"[data-page-container='true']",
		) as HTMLElement | null;
		if (nearestContainer) {
			return nearestContainer;
		}

		return document.querySelector(
			"[data-page-container='true']",
		) as HTMLElement | null;
	}, [effectiveContainerRef]);

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
		const container = resolveBoundsContainer();
		const containerRect = container?.getBoundingClientRect();

		// Use container bounds if provided, otherwise viewport
		const bounds = containerRect || {
			top: 0,
			left: 0,
			right: window.innerWidth,
			bottom: window.innerHeight,
			width: window.innerWidth,
			height: window.innerHeight,
		};

		const gap = 4;
		const padding = 8;
		const availableWidth = Math.max(
			0,
			bounds.right - bounds.left - padding * 2,
		);
		const availableHeight = Math.max(
			0,
			bounds.bottom - bounds.top - padding * 2,
		);
		const effectiveMenuWidth = Math.min(contentRect.width, availableWidth);
		const effectiveMenuHeight = Math.min(contentRect.height, availableHeight);

		let x = initialCoordsRef.current?.x ?? 0;
		let y = initialCoordsRef.current?.y ?? 0;

		// If we have a trigger reference and no explicit coords (click trigger), position relative to trigger
		if (triggerRef.current && !initialCoordsRef.current) {
			const triggerRect = triggerRef.current.getBoundingClientRect();

			// Calculate available space within container
			const spaces = {
				top: triggerRect.top - bounds.top - gap,
				bottom: bounds.bottom - triggerRect.bottom - gap,
				left: triggerRect.left - bounds.left - gap,
				right: bounds.right - triggerRect.right - gap,
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

		// Clamp to PageContainer bounds (or viewport if no container)
		x = Math.max(
			bounds.left + padding,
			Math.min(x, bounds.right - effectiveMenuWidth - padding),
		);
		y = Math.max(
			bounds.top + padding,
			Math.min(y, bounds.bottom - effectiveMenuHeight - padding),
		);

		setMenuBounds({
			maxWidth: availableWidth,
			maxHeight: availableHeight,
		});
		setCoords({ x, y });
		setIsPositioned(true);
	}, [align, placement, resolveBoundsContainer]);

	useLayoutEffect(() => {
		if (isOpen) {
			// Reset positioned state when opening
			setIsPositioned(false);
			// Defer position calculation to avoid synchronous setState warning
			// This is intentional for DOM measurement before paint
			requestAnimationFrame(() => {
				updatePosition();
			});

			const handleUpdate = () => updatePosition();
			window.addEventListener("scroll", handleUpdate, true);
			window.addEventListener("resize", handleUpdate);

			return () => {
				window.removeEventListener("scroll", handleUpdate, true);
				window.removeEventListener("resize", handleUpdate);
			};
		} else {
			setIsPositioned(false);
		}
	}, [isOpen, updatePosition]);

	useLayoutEffect(() => {
		if (!isOpen || !contentRef.current) return;

		const observer = new ResizeObserver(() => {
			setIsPositioned(false);
			if (revealTimeoutRef.current !== null) {
				window.clearTimeout(revealTimeoutRef.current);
			}
			revealTimeoutRef.current = window.setTimeout(() => {
				requestAnimationFrame(() => {
					updatePosition();
				});
			}, 40);
		});

		observer.observe(contentRef.current);

		return () => {
			observer.disconnect();
			if (revealTimeoutRef.current !== null) {
				window.clearTimeout(revealTimeoutRef.current);
				revealTimeoutRef.current = null;
			}
		};
	}, [isOpen, updatePosition]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			// The menu content is portaled to <body>, so it's outside wrapperRef.
			// Treat clicks inside either the trigger wrapper or the menu as inside.
			if (
				wrapperRef.current &&
				!wrapperRef.current.contains(target) &&
				!contentRef.current?.contains(target)
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

	// Close on leave, but not when the pointer is moving between the trigger
	// wrapper and the menu content (which is portaled to <body>, so the two are
	// not in the same DOM subtree and each fires its own mouseleave).
	const handleMouseLeave = (e: React.MouseEvent) => {
		if (!isOpen) return;
		const related = e.relatedTarget as Node | null;
		if (
			related &&
			(wrapperRef.current?.contains(related) ||
				contentRef.current?.contains(related))
		) {
			return;
		}
		closeMenu();
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

			{isOpen &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						ref={contentRef}
						style={{
							position: "fixed",
							top: coords?.y ?? 0,
							left: coords?.x ?? 0,
							maxWidth: menuBounds.maxWidth,
							maxHeight: menuBounds.maxHeight,
							overflowY: "auto",
							overflowX: "hidden",
							opacity: isPositioned ? 1 : 0,
							visibility: isPositioned ? "visible" : "hidden",
							pointerEvents: isPositioned ? "auto" : "none",
							zIndex: 9999,
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
									className="h-10! gap-2! rounded-lg! bg-neutral-800/50! pr-3! pl-0!"
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
									} group cursor-pointer rounded-lg text-left text-sm whitespace-nowrap transition-colors hover:bg-neutral-800`}
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
					</div>,
					document.body,
				)}
		</div>
	);
}
