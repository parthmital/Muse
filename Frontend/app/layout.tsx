import type { ReactNode } from "react";
import "./globals.css";
import { PageContainer } from "@/components/ui/PageContainer";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";

import { PlayerProvider } from "@/context/PlayerContext";
import { ActionMenuProvider } from "@/context/ActionMenuContext";

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
				<PlayerProvider>
					<ActionMenuProvider>
						<div className="flex h-dvh flex-col gap-4 overflow-hidden p-4">
							<TopBar />
							<div className="flex grow gap-4 overflow-hidden">
								<Sidebar />
								<div className="flex grow flex-col gap-4 overflow-hidden">
									<PageContainer>{children}</PageContainer>
									<Player />
								</div>
							</div>
						</div>
					</ActionMenuProvider>
				</PlayerProvider>
			</body>
		</html>
	);
}
