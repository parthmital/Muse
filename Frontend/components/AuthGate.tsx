"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { PageContainer } from "@/components/ui/PageContainer";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { MobileNav } from "@/components/MobileNav";
import { GlobalHotkeys } from "@/components/GlobalHotkeys";
import { RouteTransition } from "@/components/RouteTransition";

/** Routes that render without auth and without the app chrome. */
const PUBLIC_ROUTES = ["/login", "/signup"];

/**
 * Gates the authenticated app. Public routes (login/signup) render bare; every
 * other route requires a session and is wrapped in the player/nav chrome.
 */
export function AuthGate({ children }: { children: ReactNode }) {
	const { isAuthenticated, isLoading } = useAuth();
	const pathname = usePathname();
	const router = useRouter();

	const isPublic = PUBLIC_ROUTES.includes(pathname);

	// Bounce unauthenticated users to login (once the session check resolves).
	useEffect(() => {
		if (!isLoading && !isAuthenticated && !isPublic) {
			router.replace("/login");
		}
		// Bounce already-authenticated users away from login/signup.
		if (!isLoading && isAuthenticated && isPublic) {
			router.replace("/");
		}
	}, [isLoading, isAuthenticated, isPublic, router]);

	// Public pages render their own full-screen layout.
	if (isPublic) {
		return <>{children}</>;
	}

	// While the session is resolving, or while redirecting an unauthenticated
	// user, render nothing (avoids a flash of app chrome).
	if (isLoading || !isAuthenticated) {
		return (
			<div className="flex h-dvh items-center justify-center bg-black text-neutral-500">
				<span className="text-sm">Loading…</span>
			</div>
		);
	}

	return (
		<>
			<GlobalHotkeys />
			<div className="flex h-dvh flex-col gap-4 overflow-hidden p-0 md:p-4">
				<div className="hidden md:block">
					<TopBar />
				</div>
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
		</>
	);
}
