/**
 * lib/share.ts
 *
 * Share an item using the Web Share API where available (mobile), falling back
 * to copying the link to the clipboard. Returns a result the caller can turn
 * into a toast.
 */
export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareItem(data: {
	title: string;
	url?: string;
}): Promise<ShareResult> {
	const url =
		data.url ?? (typeof window !== "undefined" ? window.location.href : "");

	if (
		typeof navigator !== "undefined" &&
		typeof navigator.share === "function"
	) {
		try {
			await navigator.share({ title: data.title, url });
			return "shared";
		} catch (err) {
			// User dismissed the share sheet — not an error worth surfacing.
			if (err instanceof DOMException && err.name === "AbortError") {
				return "cancelled";
			}
			// Fall through to clipboard.
		}
	}

	if (
		typeof navigator !== "undefined" &&
		navigator.clipboard &&
		typeof navigator.clipboard.writeText === "function"
	) {
		try {
			await navigator.clipboard.writeText(url);
			return "copied";
		} catch {
			return "failed";
		}
	}

	return "failed";
}
