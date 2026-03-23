/** @type {import('next').NextConfig} */
const nextConfig = {
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
