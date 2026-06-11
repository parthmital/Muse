/* Muse service worker — app-shell + static/image runtime caching.
   Intentionally conservative: only same-origin GETs are cached, never API
   calls or audio streams (those live on the backend origin). */
const VERSION = "muse-v1";
const STATIC_CACHE = `static-${VERSION}`;
const IMAGE_CACHE = `img-${VERSION}`;

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return; // backend/CDN handled elsewhere

	if (url.pathname.startsWith("/_next/image")) {
		event.respondWith(cacheFirst(request, IMAGE_CACHE));
		return;
	}
	if (
		url.pathname.startsWith("/_next/static") ||
		url.pathname === "/icon.svg"
	) {
		event.respondWith(cacheFirst(request, STATIC_CACHE));
		return;
	}
	if (request.mode === "navigate") {
		event.respondWith(networkFirst(request, STATIC_CACHE));
	}
});

async function cacheFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	if (cached) return cached;
	try {
		const res = await fetch(request);
		if (res.ok) cache.put(request, res.clone());
		return res;
	} catch {
		return cached || Response.error();
	}
}

async function networkFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	try {
		const res = await fetch(request);
		if (res.ok) cache.put(request, res.clone());
		return res;
	} catch {
		const cached = await cache.match(request);
		return cached || (await cache.match("/")) || Response.error();
	}
}
