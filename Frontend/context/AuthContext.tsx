"use client";

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	type AuthUser,
	getMe,
	login as apiLogin,
	signup as apiSignup,
	setAuthToken,
} from "@/lib/api";

interface AuthContextType {
	user: AuthUser | null;
	/** True until the initial /auth/me check resolves. */
	isLoading: boolean;
	isAuthenticated: boolean;
	login: (email: string, password: string) => Promise<void>;
	signup: (
		email: string,
		password: string,
		displayName: string,
	) => Promise<void>;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// On mount, if a token is present, resolve the current user.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const { user } = await getMe();
				if (!cancelled) setUser(user);
			} catch {
				// No/invalid token — apiFetch already clears it on 401.
				if (!cancelled) setUser(null);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const login = useCallback(async (email: string, password: string) => {
		const result = await apiLogin(email, password);
		setAuthToken(result.token);
		setUser(result.user);
	}, []);

	const signup = useCallback(
		async (email: string, password: string, displayName: string) => {
			const result = await apiSignup(email, password, displayName);
			setAuthToken(result.token);
			setUser(result.user);
		},
		[],
	);

	const logout = useCallback(() => {
		setAuthToken(null);
		setUser(null);
		if (typeof window !== "undefined") window.location.href = "/login";
	}, []);

	const value = useMemo(
		() => ({
			user,
			isLoading,
			isAuthenticated: user !== null,
			login,
			signup,
			logout,
		}),
		[user, isLoading, login, signup, logout],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (ctx === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return ctx;
}
