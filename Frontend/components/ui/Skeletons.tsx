"use client";

import { Skeleton } from "./Skeleton";

export function TopBarSkeleton() {
	return (
		<div className="flex h-[44px] items-center justify-between gap-4 whitespace-nowrap">
			<div className="flex grow items-center gap-4">
				{[1, 2, 3, 4].map((i) => (
					<Skeleton key={i} className={`h-11 ${i === 4 ? "grow" : "w-32"}`} />
				))}
			</div>
			<div className="flex gap-2">
				{[1, 2].map((i) => (
					<Skeleton key={i} className="h-11 w-11 rounded-full" />
				))}
			</div>
		</div>
	);
}

export function SidebarSkeleton() {
	return (
		<div className="flex h-full min-w-15 shrink-0 flex-col gap-3 rounded-lg border border-neutral-800 p-4 whitespace-nowrap">
			{[1, 2, 3, 4, 5, 6].map((i) => (
				<Skeleton key={i} className="h-11 w-full" />
			))}
		</div>
	);
}

export function SearchInputSkeleton() {
	return (
		<div className="flex h-11 grow items-center gap-2 rounded-lg bg-neutral-900 pr-4 pl-1">
			<Skeleton className="h-11 w-11 rounded-full" />
			<Skeleton className="h-4 grow bg-neutral-800/50" />
		</div>
	);
}

export function MediaCardSkeleton({
	type = "album",
}: {
	type?: "artist" | "album" | "mix";
}) {
	return (
		<div className="flex flex-col gap-3">
			<Skeleton
				className={`aspect-square w-full ${type === "artist" ? "rounded-full" : "rounded-xl"}`}
			/>
			<div className="flex flex-col gap-2">
				<Skeleton className="h-5 w-3/4 rounded-md" />
				<Skeleton className="h-4 w-1/2 rounded-md opacity-50" />
			</div>
		</div>
	);
}

export function MediaGridSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
			{[...Array(12)].map((_, i) => (
				<MediaCardSkeleton key={i} />
			))}
		</div>
	);
}

export function FilterBarSkeleton() {
	return (
		<div className="flex items-center justify-between gap-4 py-2">
			<div className="flex items-center gap-2">
				{[1, 2, 3, 4, 5].map((i) => (
					<Skeleton key={i} className="h-9 w-20 rounded-full" />
				))}
			</div>
			<div className="flex items-center gap-2">
				<Skeleton className="h-9 w-9 rounded-full" />
				<Skeleton className="h-9 w-9 rounded-full" />
			</div>
		</div>
	);
}

export function LibrarySkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<FilterBarSkeleton />
			<MediaGridSkeleton />
		</div>
	);
}

export function SearchSkeleton() {
	return (
		<div className="flex flex-col gap-8">
			{/* Recent Searches Header */}
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-48 rounded-md" />
					<div className="flex gap-2">
						<Skeleton className="h-8 w-8 rounded-full" />
						<Skeleton className="h-8 w-8 rounded-full" />
					</div>
				</div>
				<div className="grid grid-cols-2 gap-6 overflow-hidden md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<MediaCardSkeleton key={i} />
					))}
				</div>
			</div>

			{/* Browse All Section */}
			<div className="flex flex-col gap-6">
				<Skeleton className="h-8 w-32 rounded-md" />
				{[1, 2, 3].map((section) => (
					<div key={section} className="flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<Skeleton className="h-6 w-32 rounded-md" />
							<div className="flex gap-2">
								<Skeleton className="h-6 w-6 rounded-full" />
								<Skeleton className="h-6 w-6 rounded-full" />
							</div>
						</div>
						<div className="flex gap-4 overflow-hidden pb-2">
							{[1, 2, 3, 4, 5, 6].map((i) => (
								<Skeleton
									key={i}
									className="h-28 min-w-[200px] flex-shrink-0 rounded-xl"
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
