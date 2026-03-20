"use client";

import { IconButton } from "./IconButton";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useRef, ChangeEvent, Suspense } from "react";
import { SearchInputSkeleton } from "./Skeletons";

interface SearchInputProps {
	placeholder?: string;
	autoFocus?: boolean;
	className?: string;
	onClose?: () => void;
	preventNavigation?: boolean;
	onChange?: (value: string) => void;
}

function SearchInputContent({
	placeholder = "Search...",
	autoFocus = false,
	className = "",
	onClose,
	preventNavigation = false,
	onChange,
}: SearchInputProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const pathname = usePathname();
	const [query, setQuery] = useState(searchParams.get("q") || "");
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		const q = searchParams.get("q") || "";
		if (q !== query) {
			setQuery(q);
		}
	}, [searchParams]);

	const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setQuery(val);
		if (onChange) onChange(val);

		if (!preventNavigation) {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => {
				if (val.trim()) {
					const params = new URLSearchParams(searchParams.toString());
					params.set("q", val);
					if (pathname !== "/search") {
						router.push(`/search?${params.toString()}`);
					} else {
						router.replace(`/search?${params.toString()}`);
					}
				} else if (pathname === "/search") {
					router.replace("/search");
				}
			}, 300);
		}
	};

	return (
		<div
			className={`flex grow items-center gap-2 rounded-lg bg-neutral-900 ${
				onClose ? "pr-1" : "pr-4"
			} pl-1 text-white ${className}`}
		>
			<IconButton icon="Search" alt="Search" filled={true} noHover={true} />
			<input
				type="text"
				placeholder={placeholder}
				className="grow bg-transparent outline-none placeholder:text-neutral-500"
				autoFocus={autoFocus}
				value={query}
				onChange={handleSearch}
			/>
			{onClose && <IconButton icon="Close" alt="Close" onClick={onClose} />}
		</div>
	);
}

export function SearchInput({
	placeholder = "Search...",
	autoFocus = false,
	className = "",
	onClose,
	preventNavigation = false,
	onChange,
}: SearchInputProps) {
	return (
		<Suspense fallback={<SearchInputSkeleton />}>
			<SearchInputContent
				placeholder={placeholder}
				autoFocus={autoFocus}
				className={className}
				onClose={onClose}
				preventNavigation={preventNavigation}
				onChange={onChange}
			/>
		</Suspense>
	);
}
