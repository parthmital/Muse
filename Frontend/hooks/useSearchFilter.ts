"use client";

import { useState, useMemo } from "react";

export function useSearchFilter<T>(
	items: T[],
	filterFn: (item: T, query: string) => boolean,
) {
	const [searchQuery, setSearchQuery] = useState("");

	const filteredItems = useMemo(() => {
		return items.filter((item) => filterFn(item, searchQuery));
	}, [items, searchQuery, filterFn]);

	return { searchQuery, setSearchQuery, filteredItems };
}
