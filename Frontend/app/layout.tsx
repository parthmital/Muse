import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthGate } from "@/components/AuthGate";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

import { AuthProvider } from "@/context/AuthContext";
import { PlayerProvider } from "@/context/PlayerContext";
import { ActionMenuProvider } from "@/context/ActionMenuContext";
import { ToastProvider } from "@/context/ToastContext";

export const metadata: Metadata = {
	title: "Muse",
	description: "Discover and stream music in hi-fi.",
	applicationName: "Muse",
	manifest: "/manifest.webmanifest",
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: "Muse",
	},
	icons: {
		icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
		apple: "/icon.svg",
	},
};

export const viewport: Viewport = {
	themeColor: "#000000",
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin=""
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Sansation:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap"
					rel="stylesheet"
				/>
				{/* eslint-disable-next-line @next/next/no-page-custom-font */}
			</head>
			<body className="scrollbar-hide bg-black text-neutral-400">
				<a
					href="#main-content"
					className="sr-only z-9999 rounded-lg bg-white px-4 py-2 font-bold text-black focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
				>
					Skip to content
				</a>
				<AuthProvider>
					<PlayerProvider>
						<ToastProvider>
							<ActionMenuProvider>
								<AuthGate>{children}</AuthGate>
								<ServiceWorkerRegistrar />
							</ActionMenuProvider>
						</ToastProvider>
					</PlayerProvider>
				</AuthProvider>
			</body>
		</html>
	);
}
