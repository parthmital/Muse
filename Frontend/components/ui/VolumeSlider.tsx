"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface VolumeSliderProps {
	/** Current volume, 0..1. */
	value: number;
	onChange: (value: number) => void;
	className?: string;
}

/**
 * Vertical volume slider. Drag (or arrow keys) up to raise, down to lower.
 * The top of the track is 100%, the bottom is 0%.
 */
export function VolumeSlider({
	value,
	onChange,
	className = "",
}: VolumeSliderProps) {
	const [isDragging, setIsDragging] = useState(false);
	const trackRef = useRef<HTMLDivElement>(null);
	const percent = Math.max(0, Math.min(1, value)) * 100;

	const positionToValue = useCallback((clientY: number) => {
		const el = trackRef.current;
		if (!el) return 0;
		const rect = el.getBoundingClientRect();
		const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
		// Top edge = full volume, bottom edge = muted.
		return 1 - y / rect.height;
	}, []);

	const handleMouseDown = (e: React.MouseEvent) => {
		setIsDragging(true);
		onChange(positionToValue(e.clientY));
	};

	useEffect(() => {
		if (!isDragging) return;
		const move = (e: MouseEvent) => onChange(positionToValue(e.clientY));
		const up = () => setIsDragging(false);
		window.addEventListener("mousemove", move);
		window.addEventListener("mouseup", up);
		return () => {
			window.removeEventListener("mousemove", move);
			window.removeEventListener("mouseup", up);
		};
	}, [isDragging, positionToValue, onChange]);

	return (
		<div
			ref={trackRef}
			role="slider"
			aria-label="Volume"
			aria-orientation="vertical"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(percent)}
			tabIndex={0}
			onMouseDown={handleMouseDown}
			onKeyDown={(e) => {
				if (e.key === "ArrowUp") {
					e.preventDefault();
					onChange(Math.min(1, value + 0.05));
				} else if (e.key === "ArrowDown") {
					e.preventDefault();
					onChange(Math.max(0, value - 0.05));
				}
			}}
			className={`group relative w-1.5 cursor-pointer rounded-full bg-neutral-700 ${className}`}
		>
			<div
				className="absolute bottom-0 w-full rounded-full bg-white"
				style={{ height: `${percent}%` }}
			/>
			<div
				className="absolute left-1/2 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
				style={{ bottom: `${percent}%` }}
			/>
		</div>
	);
}
