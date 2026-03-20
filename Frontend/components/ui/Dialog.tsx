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

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};

		if (isOpen) {
			document.addEventListener("keydown", handleEscape);
			document.body.style.overflow = "hidden";
		}

		return () => {
			document.removeEventListener("keydown", handleEscape);
			document.body.style.overflow = "unset";
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
			<div className="animate-in zoom-in-95 w-full max-w-md overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl duration-200">
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
