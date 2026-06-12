"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "@/context/PlayerContext";
import { fetchLyrics, type LyricsResult } from "@/lib/lyrics";

export function Lyrics() {
	const { currentTrack, duration, progress, seek } = usePlayer();
	const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
	const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
	const activeRef = useRef<HTMLButtonElement>(null);

	const trackKey = currentTrack
		? `${currentTrack.title}|${currentTrack.artist}`
		: null;

	useEffect(() => {
		if (!currentTrack) return;
		const controller = new AbortController();
		setStatus("loading");
		setLyrics(null);
		fetchLyrics({
			artist: currentTrack.artist,
			title: currentTrack.title,
			album: currentTrack.album,
			durationSec: duration || undefined,
			signal: controller.signal,
		})
			.then((res) => {
				setLyrics(res);
				setStatus("done");
			})
			.catch(() => setStatus("done"));
		return () => controller.abort();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [trackKey]);

	const activeLine = useMemo(() => {
		if (!lyrics?.synced) return -1;
		let idx = -1;
		for (let i = 0; i < lyrics.synced.length; i++) {
			if (lyrics.synced[i].time <= progress + 0.25) idx = i;
			else break;
		}
		return idx;
	}, [lyrics, progress]);

	useEffect(() => {
		activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [activeLine]);

	if (status === "loading") {
		return (
			<div className="flex h-full items-center justify-center text-neutral-500">
				<div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
			</div>
		);
	}

	if (!lyrics) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 text-center text-neutral-500">
				<p className="text-lg">No lyrics found</p>
				<p className="text-sm">We couldn&apos;t find lyrics for this track.</p>
			</div>
		);
	}

	if (lyrics.synced) {
		return (
			<div className="h-full overflow-y-auto py-8 text-2xl font-bold leading-relaxed">
				{lyrics.synced.map((line, i) => (
					<button
						key={`${line.time}-${i}`}
						ref={i === activeLine ? activeRef : null}
						onClick={() => seek(line.time)}
						className={`block w-full py-1 text-left transition-colors ${
							i === activeLine
								? "text-white"
								: i < activeLine
									? "text-neutral-600"
									: "text-neutral-400 hover:text-neutral-200"
						}`}
					>
						{line.text || "♪"}
					</button>
				))}
			</div>
		);
	}

	return (
		<div className="h-full overflow-y-auto py-8 text-lg leading-relaxed whitespace-pre-wrap text-neutral-300">
			{lyrics.plain}
		</div>
	);
}
