"use client";

import { Song, SongRow } from "@/components/SongRow";

interface ArtistHomeContentProps {
	mostPlayed: Song[];
	popular: Song[];
}

export function ArtistHomeContent({
	mostPlayed,
	popular,
}: ArtistHomeContentProps) {
	return (
		<>
			{/* Most Played Section */}
			<section className="flex flex-col gap-4">
				<h2 className="text-xl font-bold text-white">Your most played</h2>
				<div className="flex flex-col gap-2">
					{mostPlayed.length > 0 ? (
						mostPlayed
							.slice(0, 5)
							.map((song, index) => (
								<SongRow key={index} song={song} index={index} hideAlbum />
							))
					) : (
						<div className="py-4 text-neutral-500 italic">
							No play data available yet.
						</div>
					)}
				</div>
			</section>

			{/* Popular Section */}
			<section className="flex flex-col gap-4">
				<h2 className="text-xl font-bold text-white">Popular</h2>
				<div className="flex flex-col gap-2">
					{popular.length > 0 ? (
						popular.map((song, index) => (
							<SongRow key={index} song={song} index={index} hideAlbum />
						))
					) : (
						<div className="py-4 text-neutral-500 italic">
							No popular songs found for this artist.
						</div>
					)}
				</div>
			</section>
		</>
	);
}
