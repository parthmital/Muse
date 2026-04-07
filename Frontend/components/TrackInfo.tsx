import { FallbackImage } from "./ui/FallbackImage";

interface TrackInfoProps {
	image: string;
	title: string;
	artist: string;
	className?: string;
}

export function TrackInfo({
	image,
	title,
	artist,
	className = "",
}: TrackInfoProps) {
	return (
		<div className={`flex items-center gap-3 ${className}`}>
			<div className="relative h-12 w-12 shrink-0">
				<FallbackImage
					className="rounded-lg object-cover"
					src={image}
					alt={title}
					fill
					sizes="48px"
					fallbackType="Notes"
				/>
			</div>
			<div className="flex flex-col gap-1">
				<p className="line-clamp-1 cursor-pointer text-base text-white hover:underline">
					{title}
				</p>
				<p className="line-clamp-1 cursor-pointer hover:underline">{artist}</p>
			</div>
		</div>
	);
}
