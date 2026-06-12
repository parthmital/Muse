"use client";

import React, {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";

export type ToastVariant = "default" | "success" | "error";

export interface Toast {
	id: number;
	message: string;
	variant: ToastVariant;
	actionLabel?: string;
	onAction?: () => void;
}

interface ToastInput {
	message: string;
	variant?: ToastVariant;
	durationMs?: number;
	actionLabel?: string;
	onAction?: () => void;
}

interface ToastContextType {
	/** Show a toast. Accepts a plain string or a richer object. */
	toast: (input: string | ToastInput) => void;
	dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const VARIANT_STYLES: Record<ToastVariant, string> = {
	default: "border-neutral-700 bg-neutral-900 text-white",
	success: "border-green-500/40 bg-neutral-900 text-white",
	error: "border-red-500/40 bg-neutral-900 text-white",
};

const VARIANT_DOT: Record<ToastVariant, string> = {
	default: "bg-neutral-400",
	success: "bg-green-500",
	error: "bg-red-500",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const idRef = useRef(0);
	const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

	const dismiss = useCallback((id: number) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
		const timer = timers.current.get(id);
		if (timer) {
			clearTimeout(timer);
			timers.current.delete(id);
		}
	}, []);

	const toast = useCallback(
		(input: string | ToastInput) => {
			const opts: ToastInput =
				typeof input === "string" ? { message: input } : input;
			const id = ++idRef.current;
			const next: Toast = {
				id,
				message: opts.message,
				variant: opts.variant ?? "default",
				actionLabel: opts.actionLabel,
				onAction: opts.onAction,
			};
			setToasts((prev) => [...prev.slice(-2), next]);
			const timer = setTimeout(() => dismiss(id), opts.durationMs ?? 3200);
			timers.current.set(id, timer);
		},
		[dismiss],
	);

	const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<div
				className="pointer-events-none fixed bottom-28 left-1/2 z-9998 flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4"
				role="region"
				aria-label="Notifications"
			>
				{toasts.map((t) => (
					<div
						key={t.id}
						role="status"
						aria-live="polite"
						className={`pointer-events-auto flex w-full items-center gap-3 rounded-lg border px-4 py-3 shadow-xl backdrop-blur-md duration-200 animate-in fade-in slide-in-from-bottom-2 ${VARIANT_STYLES[t.variant]}`}
					>
						<span
							className={`h-2 w-2 shrink-0 rounded-full ${VARIANT_DOT[t.variant]}`}
						/>
						<span className="min-w-0 grow truncate text-sm">{t.message}</span>
						{t.actionLabel && t.onAction && (
							<button
								className="shrink-0 text-sm font-bold text-white hover:underline"
								onClick={() => {
									t.onAction?.();
									dismiss(t.id);
								}}
							>
								{t.actionLabel}
							</button>
						)}
						<button
							aria-label="Dismiss notification"
							className="shrink-0 text-neutral-500 hover:text-white"
							onClick={() => dismiss(t.id)}
						>
							✕
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast() {
	const ctx = useContext(ToastContext);
	if (ctx === undefined) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return ctx;
}
