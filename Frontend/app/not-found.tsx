import Link from "next/link";

export default function NotFound() {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-4 text-center">
			<h1 className="text-xl font-bold text-white">404 - Page Not Found</h1>
			<p>Oops! The page you&apos;re looking for doesn&apos;t exist.</p>
			<Link
				href="/"
				className="rounded-lg bg-white px-4 py-2 font-medium text-black"
			>
				Return Home
			</Link>
		</div>
	);
}
