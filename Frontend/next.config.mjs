/** @type {import('next').NextConfig} */
const nextConfig = {
	reactCompiler: true,
	images: {
		dangerouslyAllowLocalIP: true,
		// Serve modern formats; covers are immutable so cache them aggressively.
		formats: ["image/avif", "image/webp"],
		minimumCacheTTL: 31536000,
		remotePatterns: [
			{
				protocol: "http",
				hostname: "localhost",
				port: "5000",
				pathname: "/tidal/images/**",
			},
			{
				protocol: "http",
				hostname: "127.0.0.1",
				port: "5000",
				pathname: "/tidal/images/**",
			},
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
