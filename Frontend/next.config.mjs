/** @type {import('next').NextConfig} */
const nextConfig = {
	reactCompiler: true,
	images: {
		dangerouslyAllowLocalIP: true,
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
