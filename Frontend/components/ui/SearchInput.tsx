"use client";

import Image from "next/image";
import { IconButton } from "./IconButton";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { SearchInputSkeleton } from "./Skeletons";
import { searchAll, getRecentSearches, saveSearch } from "@/lib/api";

interface SearchInputProps {
	placeholder?: string;
	autoFocus?: boolean;
	className?: string;
	onClose?: () => void;
	preventNavigation?: boolean;
	onChange?: (value: string) => void;
	onSearch?: (value: string) => void;
}

interface Suggestion {
	key: string;
	label: string;
	sub?: string;
	href: string;
	type: "artist" | "album" | "track" | "recent";
	icon: string;
	// What to persist to search history when this suggestion is chosen, so the
	// recent-search card carries a real tidalId and routes to the item.
	save?: { itemType: string; itemId: string; imageUrl?: string };
}

function SearchInputContent({
	placeholder = "Search...",
	autoFocus = false,
	className = "",
	onClose,
	preventNavigation = false,
	onChange,
	onSearch,
}: SearchInputProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const pathname = usePathname();
	const [query, setQuery] = useState(searchParams.get("q") || "");
	const [open, setOpen] = useState(false);
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [recents, setRecents] = useState<Suggestion[]>([]);
	const [activeIndex, setActiveIndex] = useState(-1);
	const containerRef = useRef<HTMLDivElement>(null);

	// Suggestions are a global-search affordance only — skip them when the input
	// is acting as an in-page filter (album/playlist/artist).
	const enableSuggestions = !preventNavigation;

	useEffect(() => {
		const q = searchParams.get("q") || "";
		if (q !== query) setQuery(q);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams]);

	// Load recent searches once when suggestions are enabled.
	useEffect(() => {
		if (!enableSuggestions) return;
		let cancelled = false;
		getRecentSearches()
			.then((res) => {
				if (cancelled) return;
				const items = (res.items || [])
					.map((it: Record<string, unknown>) => {
						const q = String(it.query ?? it.metadata ?? "").trim();
						return q
							? ({
									key: `recent-${q}`,
									label: q,
									sub: "Recent search",
									href: `/search?q=${encodeURIComponent(q)}`,
									type: "recent" as const,
									icon: "History",
								} satisfies Suggestion)
							: null;
					})
					.filter(Boolean) as Suggestion[];
				setRecents(items.slice(0, 6));
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [enableSuggestions]);

	// Debounced live suggestions.
	useEffect(() => {
		if (!enableSuggestions) return;
		const q = query.trim();
		if (q.length < 2) {
			setSuggestions([]);
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(() => {
			searchAll(q, 5, controller.signal)
				.then((res) => {
					const out: Suggestion[] = [];
					for (const a of (res.artists || []).slice(0, 3)) {
						out.push({
							key: `artist-${a.id}`,
							label: a.name,
							sub: "Artist",
							href: `/artist/${a.id}`,
							type: "artist",
							icon: "Artist",
							save: {
								itemType: "artist",
								itemId: String(a.id),
								imageUrl: a.picture ?? undefined,
							},
						});
					}
					for (const t of (res.tracks || []).slice(0, 4)) {
						out.push({
							key: `track-${t.id}`,
							label: t.title,
							sub: `${t.artist?.name ?? "Unknown"} • Song`,
							href: t.album?.id
								? `/album/${t.album.id}`
								: `/search?q=${encodeURIComponent(q)}`,
							type: "track",
							icon: "Notes",
							// Tracks route to their album, so record the album.
							save: t.album?.id
								? {
										itemType: "album",
										itemId: String(t.album.id),
										imageUrl: t.album?.cover ?? undefined,
									}
								: undefined,
						});
					}
					for (const al of (res.albums || []).slice(0, 3)) {
						out.push({
							key: `album-${al.id}`,
							label: al.title,
							sub: `${al.artist?.name ?? "Unknown"} • Album`,
							href: `/album/${al.id}`,
							type: "album",
							icon: "Album",
							save: {
								itemType: "album",
								itemId: String(al.id),
								imageUrl: al.cover ?? undefined,
							},
						});
					}
					setSuggestions(out);
					setActiveIndex(-1);
				})
				.catch(() => {});
		}, 220);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [query, enableSuggestions]);

	// Close on outside click.
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, [open]);

	const options = query.trim().length >= 2 ? suggestions : recents;

	const submitQuery = useCallback(
		(val: string) => {
			if (onSearch) onSearch(val);
			if (preventNavigation) return;
			if (val.trim()) {
				const params = new URLSearchParams(searchParams.toString());
				params.set("q", val);
				if (pathname !== "/search") router.push(`/search?${params.toString()}`);
				else router.replace(`/search?${params.toString()}`);
			} else if (pathname === "/search") {
				router.replace("/search");
			}
		},
		[onSearch, preventNavigation, searchParams, pathname, router],
	);

	const choose = useCallback(
		(s: Suggestion) => {
			setOpen(false);
			if (s.type === "recent") {
				setQuery(s.label);
				submitQuery(s.label);
			} else {
				// Only record the clicked item, never the raw typed query.
				if (s.save) {
					saveSearch({
						query: s.label,
						itemType: s.save.itemType,
						itemId: s.save.itemId,
						imageUrl: s.save.imageUrl,
					}).catch(() => {});
				}
				router.push(s.href);
			}
		},
		[router, submitQuery],
	);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (open && options.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setActiveIndex((i) => (i + 1) % options.length);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
				return;
			}
			if (e.key === "Escape") {
				setOpen(false);
				return;
			}
		}
		if (e.key === "Enter") {
			if (open && activeIndex >= 0 && options[activeIndex]) {
				choose(options[activeIndex]);
			} else {
				setOpen(false);
				submitQuery(query);
			}
		}
	};

	return (
		<div ref={containerRef} className={`relative grow ${className}`}>
			<div
				className={`flex w-full items-center gap-2 rounded-lg bg-neutral-900 ${
					onClose ? "pr-1" : "pr-4"
				} pl-1 text-white`}
			>
				<IconButton icon="Search" alt="Search" filled={true} noHover={true} />
				<input
					type="text"
					role="combobox"
					aria-expanded={open && options.length > 0}
					aria-controls="search-suggestions"
					aria-label="Search"
					placeholder={placeholder}
					className="grow bg-transparent outline-none placeholder:text-neutral-500"
					autoFocus={autoFocus}
					value={query}
					onFocus={() => setOpen(true)}
					onChange={(e) => {
						setQuery(e.target.value);
						setOpen(true);
						if (onChange) onChange(e.target.value);
					}}
					onKeyDown={handleKeyDown}
				/>
				{onClose && <IconButton icon="Close" alt="Close" onClick={onClose} />}
			</div>

			{enableSuggestions && open && options.length > 0 && (
				<div
					id="search-suggestions"
					role="listbox"
					className="absolute top-full right-0 left-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950 p-1 shadow-2xl duration-150 animate-in fade-in slide-in-from-top-2"
				>
					{query.trim().length < 2 && (
						<p className="px-3 py-1.5 text-xs font-bold tracking-wide text-neutral-500 uppercase">
							Recent
						</p>
					)}
					{options.map((s, i) => (
						<button
							key={s.key}
							role="option"
							aria-selected={i === activeIndex}
							onMouseEnter={() => setActiveIndex(i)}
							onMouseDown={(e) => {
								e.preventDefault();
								choose(s);
							}}
							className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${
								i === activeIndex ? "bg-neutral-800" : "hover:bg-neutral-900"
							}`}
						>
							<Image
								src={`/icons/Name=${s.icon}, Filled=No.svg`}
								alt=""
								width={40}
								height={40}
								className="shrink-0 opacity-60 brightness-0 invert"
							/>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm text-white">
									{s.label}
								</span>
								{s.sub && (
									<span className="block truncate text-xs text-neutral-500">
										{s.sub}
									</span>
								)}
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

export function SearchInput(props: SearchInputProps) {
	return (
		<Suspense fallback={<SearchInputSkeleton />}>
			<SearchInputContent {...props} />
		</Suspense>
	);
}
