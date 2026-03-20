import { MediaItem } from "@/components/MediaCard";

export const ALL_ALBUMS: MediaItem[] = [
	{
		type: "album",
		title: "Meteora",
		artist: "Linkin Park",
		songs: 13,
	},
	{
		type: "album",
		title: "Random Access Memories",
		artist: "Daft Punk",
		songs: 13,
	},
	{
		type: "album",
		title: "Abbey Road",
		artist: "The Beatles",
		songs: 17,
	},
	{
		type: "album",
		title: "Black Holes and Revelations",
		artist: "Muse",
		songs: 11,
	},
	{
		type: "album",
		title: "Discovery",
		artist: "Daft Punk",
		songs: 14,
	},
	{
		type: "album",
		title: "Hybrid Theory",
		artist: "Linkin Park",
		songs: 12,
	},
	{
		type: "album",
		title: "Homework",
		artist: "Daft Punk",
		songs: 16,
	},
	{
		type: "album",
		title: "8 Mile",
		artist: "Eminem",
		songs: 16,
	},
	{
		type: "album",
		title: "Tron: Legacy",
		artist: "Daft Punk",
		songs: 22,
	},
	{
		type: "album",
		title: "Alive 2007",
		artist: "Daft Punk",
		songs: 12,
	},
	{
		type: "album",
		title: "Human After All",
		artist: "Daft Punk",
		songs: 10,
	},
	{
		type: "album",
		title: "Starboy",
		artist: "The Weeknd",
		songs: 18,
	},
	{
		type: "album",
		title: "Get Lucky (Remixes)",
		artist: "Daft Punk",
		songs: 4,
	},
	{
		type: "album",
		title: "Musique Vol. 1 1993–2005",
		artist: "Daft Punk",
		songs: 15,
	},
];

export const ALL_PLAYLISTS: MediaItem[] = [
	{
		type: "mix",
		title: "Chill Stuff",
		songs: 85,
		desc: "Relaxing tunes for your downtime.",
	},
	{
		type: "mix",
		title: "Vibe",
		songs: 42,
		desc: "Setting the mood with curated tracks.",
	},
	{
		type: "mix",
		title: "Selected Linkin Park",
		songs: 25,
		desc: "The best of Linkin Park curated for you.",
	},
	{
		type: "mix",
		title: "Fav Bands",
		songs: 68,
		desc: "A collection of your most-listened-to bands.",
	},
	{
		type: "mix",
		title: "Daily Mix 1",
		songs: 50,
		desc: "Linkin Park, System Of A Down, Coal Chamber, Korn, and Slipknot.",
	},
	{
		type: "mix",
		title: "Daily Mix 2",
		songs: 50,
		desc: "Daft Punk, Justice, The Chemical Brothers, and Gorillaz.",
	},
	{
		type: "mix",
		title: "Daily Mix 3",
		songs: 50,
		desc: "David Bowie, Queen, Pink Floyd, and Led Zeppelin.",
	},
	{
		type: "mix",
		title: "Daily Mix 4",
		songs: 50,
		desc: "Nirvana, Soundgarden, Pearl Jam, Alice In Chains, and Mudhoney.",
	},
	{
		type: "mix",
		title: "Rock Mix",
		songs: 50,
		desc: "A high-energy collection of classic rock anthems and modern hits.",
	},
	{
		type: "mix",
		title: "Chill Mix",
		songs: 50,
		desc: "Lo-fi beats and acoustic tracks perfect for focus or relaxation.",
	},
	{
		type: "mix",
		title: "Pop Mix",
		songs: 50,
		desc: "The biggest chart-toppers and viral favourites from around the globe.",
	},
	{
		type: "mix",
		title: "Discover Weekly",
		songs: 50,
		desc: "Your weekly mixtape of fresh music.",
	},
	{
		type: "mix",
		title: "Happy Mix",
		songs: 50,
		desc: "Uplifting melodies and bright rhythms to brighten up your day.",
	},
	{
		type: "mix",
		title: "Upbeat Mix",
		songs: 50,
		desc: "Fast-paced tracks designed to keep your momentum going.",
	},
	{
		type: "mix",
		title: "60s Mix",
		songs: 50,
		desc: "Timeless classics from the decade that redefined music history.",
	},
	{
		type: "mix",
		title: "Nirvana Radio",
		songs: 50,
		desc: "The definitive grunge experience featuring Nirvana and the icons of the Seattle sound.",
	},
	{
		type: "mix",
		title: "Fall Out Boy Radio",
		songs: 50,
		desc: "Fuel your nostalgia with the best of Fall Out Boy and the pop-punk revolution.",
	},
	{
		type: "mix",
		title: "Daft Punk Mix",
		songs: 50,
		desc: "An essential selection of French house and electronic masterpieces.",
	},
	{
		type: "mix",
		title: "David Bowie Mix",
		songs: 50,
		desc: "A journey through the iconic discography of the Starman himself.",
	},
	{
		type: "mix",
		title: "Nirvana Radio",
		songs: 50,
		desc: "The definitive grunge experience.",
	},
];

export const ALL_ARTISTS: MediaItem[] = [
	{
		type: "artist",
		title: "Daft Punk",
	},
	{
		type: "artist",
		title: "David Bowie",
	},
	{
		type: "artist",
		title: "Muse",
	},
	{
		type: "artist",
		title: "Linkin Park",
	},
	{
		type: "artist",
		title: "The Beatles",
	},
	{
		type: "artist",
		title: "Eminem",
	},
	{
		type: "artist",
		title: "Guns N' Roses",
	},
	{
		type: "artist",
		title: "M83",
	},
	{
		type: "artist",
		title: "The Weeknd",
	},
	{
		type: "artist",
		title: "Pharrell Williams",
	},
	{
		type: "artist",
		title: "Nile Rodgers",
	},
];

export const ALL_LIBRARY_ITEMS: MediaItem[] = [
	...ALL_ARTISTS,
	...ALL_ALBUMS,
	...ALL_PLAYLISTS,
];
