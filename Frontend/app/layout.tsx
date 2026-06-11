import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PageContainer } from "@/components/ui/PageContainer";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { MobileNav } from "@/components/MobileNav";
import { GlobalHotkeys } from "@/components/GlobalHotkeys";
import { RouteTransition } from "@/components/RouteTransition";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

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
					className="sr-only z-[9999] rounded-lg bg-white px-4 py-2 font-bold text-black focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
				>
					Skip to content
				</a>
				<PlayerProvider>
					<ToastProvider>
						<ActionMenuProvider>
							<GlobalHotkeys />
							<div className="flex h-dvh flex-col gap-4 overflow-hidden p-2 pb-28 sm:p-4 sm:pb-28 md:pb-4">
								<TopBar />
								<div className="flex grow gap-4 overflow-hidden">
									<Sidebar />
									<div className="flex grow flex-col gap-2 overflow-hidden sm:gap-4">
										<main
											id="main-content"
											className="flex min-h-0 grow flex-col overflow-hidden"
										>
											<PageContainer>
												<RouteTransition>{children}</RouteTransition>
											</PageContainer>
										</main>
										<Player />
									</div>
								</div>
							</div>
							<MobileNav />
							<ServiceWorkerRegistrar />
						</ActionMenuProvider>
					</ToastProvider>
				</PlayerProvider>
			</body>
		</html>
	);
}
