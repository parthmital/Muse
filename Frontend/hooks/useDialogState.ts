"use client";

import { useState, useCallback } from "react";

export function useDialogState<T = void>(defaultOpen = false) {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const [data, setData] = useState<T | null>(null);

	const open = useCallback((dialogData?: T) => {
		if (dialogData !== undefined) setData(dialogData);
		setIsOpen(true);
	}, []);

	const close = useCallback(() => {
		setIsOpen(false);
		setData(null);
	}, []);

	const toggle = useCallback(() => {
		setIsOpen((prev) => !prev);
	}, []);

	return { isOpen, open, close, toggle, data, setIsOpen };
}
