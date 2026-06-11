"use client";

import { useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";

interface DialogProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
}

export function Dialog({ isOpen, onClose, title, children }: DialogProps) {
	const overlayRef = useRef<HTMLDivElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;

		const previouslyFocused = document.activeElement as HTMLElement | null;

		const getFocusable = () =>
			Array.from(
				dialogRef.current?.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
				) ?? [],
			);

		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
				return;
			}
			if (e.key !== "Tab") return;
			const focusable = getFocusable();
			if (focusable.length === 0) {
				e.preventDefault();
				dialogRef.current?.focus();
				return;
			}
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			const active = document.activeElement;
			if (e.shiftKey && active === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && active === last) {
				e.preventDefault();
				first.focus();
			}
		};

		document.addEventListener("keydown", handleKey);
		document.body.style.overflow = "hidden";

		// Move focus into the dialog.
		const focusable = getFocusable();
		(focusable[0] ?? dialogRef.current)?.focus();

		return () => {
			document.removeEventListener("keydown", handleKey);
			document.body.style.overflow = "unset";
			previouslyFocused?.focus?.();
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	const handleOverlayClick = (e: React.MouseEvent) => {
		if (e.target === overlayRef.current) onClose();
	};

	return createPortal(
		<div
			ref={overlayRef}
			onClick={handleOverlayClick}
			className="animate-in fade-in fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm duration-200"
		>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				tabIndex={-1}
				className="animate-in zoom-in-95 w-full max-w-md overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl duration-200 outline-none"
			>
				<div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
					<h2 className="text-xl font-bold text-white">{title}</h2>
					<IconButton icon="Close" alt="Close" onClick={onClose} />
				</div>
				<div className="p-6">{children}</div>
			</div>
		</div>,
		document.body,
	);
}
