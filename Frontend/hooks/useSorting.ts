"use client";

import { useState, useCallback } from "react";

interface UseSortingOptions<T> {
	items: T[];
	defaultSortKey?: string;
	defaultSortOrder?: "asc" | "desc";
	comparators: Record<string, (a: T, b: T) => number>;
}

interface UseSortingResult<T> {
	sortedItems: T[];
	sortBy: string;
	sortOrder: "asc" | "desc";
	setSortBy: (key: string) => void;
	setSortOrder: (order: "asc" | "desc") => void;
	handleSort: (key: string) => void;
}

/**
 * Reusable hook for sorting logic used across library, liked, album, and playlist pages.
 *
 * `comparators` maps sort keys to comparison functions (ascending order).
 * The hook automatically reverses order when `sortOrder` is "desc".
 */
export function useSorting<T>({
	items,
	defaultSortKey = "default",
	defaultSortOrder = "asc",
	comparators,
}: UseSortingOptions<T>): UseSortingResult<T> {
	const [sortBy, setSortBy] = useState(defaultSortKey);
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">(defaultSortOrder);

	const handleSort = useCallback(
		(key: string) => {
			if (sortBy === key) {
				setSortOrder(sortOrder === "asc" ? "desc" : "asc");
			} else {
				setSortBy(key);
				setSortOrder("asc");
			}
		},
		[sortBy, sortOrder],
	);

	const sortedItems = [...items].sort((a, b) => {
		const comparator = comparators[sortBy];
		if (!comparator) return 0;
		return comparator(a, b);
	});

	if (sortOrder === "desc") {
		sortedItems.reverse();
	}

	return {
		sortedItems,
		sortBy,
		sortOrder,
		setSortBy,
		setSortOrder,
		handleSort,
	};
}
