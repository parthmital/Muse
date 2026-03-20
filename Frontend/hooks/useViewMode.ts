"use client";

import { useState, useCallback } from "react";

export function useViewMode(defaultMode: "grid" | "list" = "grid") {
	const [viewMode, setViewMode] = useState<"grid" | "list">(defaultMode);

	const toggleViewMode = useCallback(() => {
		setViewMode((prev) => (prev === "grid" ? "list" : "grid"));
	}, []);

	return { viewMode, setViewMode, toggleViewMode };
}
