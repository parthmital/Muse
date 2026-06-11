import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Muse",
		short_name: "Muse",
		description: "Discover and stream music in hi-fi.",
		start_url: "/",
		scope: "/",
		display: "standalone",
		background_color: "#000000",
		theme_color: "#000000",
		categories: ["music", "entertainment"],
		icons: [
			{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
			{
				src: "/icon.svg",
				sizes: "any",
				type: "image/svg+xml",
				purpose: "maskable",
			},
		],
	};
}
