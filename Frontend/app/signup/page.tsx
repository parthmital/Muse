"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

export default function SignupPage() {
	const { signup } = useAuth();
	const router = useRouter();

	const [displayName, setDisplayName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		setSubmitting(true);
		try {
			await signup(email, password, displayName);
			router.replace("/");
		} catch (err) {
			setError(
				err instanceof ApiError
					? err.message
					: "Something went wrong. Please try again.",
			);
			setSubmitting(false);
		}
	};

	return (
		<div className="flex min-h-dvh items-center justify-center bg-black px-4">
			<div className="w-full max-w-sm">
				<h1 className="mb-1 text-center text-3xl font-bold text-white">Muse</h1>
				<p className="mb-8 text-center text-sm text-neutral-400">
					Create your free account
				</p>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-neutral-300">
							Display name
						</label>
						<input
							type="text"
							autoComplete="nickname"
							required
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-green-500"
						/>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-neutral-300">
							Email
						</label>
						<input
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-green-500"
						/>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-neutral-300">
							Password
						</label>
						<input
							type="password"
							autoComplete="new-password"
							required
							minLength={8}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-green-500"
						/>
						<p className="mt-1 text-xs text-neutral-500">
							At least 8 characters.
						</p>
					</div>

					{error && (
						<p className="text-sm text-red-500" role="alert">
							{error}
						</p>
					)}

					<button
						type="submit"
						disabled={submitting}
						className="w-full rounded-full bg-green-500 py-3 font-bold text-black transition-colors hover:bg-green-400 disabled:opacity-60"
					>
						{submitting ? "Creating account…" : "Sign up"}
					</button>
				</form>

				<p className="mt-6 text-center text-sm text-neutral-400">
					Already have an account?{" "}
					<Link href="/login" className="font-bold text-white hover:underline">
						Log in
					</Link>
				</p>
			</div>
		</div>
	);
}
