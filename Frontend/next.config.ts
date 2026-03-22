import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactCompiler: true,
	images: {
		unoptimized: true,
		remotePatterns: [
			{
				protocol: "https",
				hostname: "resources.tidal.com",
				pathname: "/images/**",
			},
			{
				protocol: "https",
				hostname: "images.tidal.com",
				pathname: "/**",
			},
		],
	},
};

export default nextConfig;
