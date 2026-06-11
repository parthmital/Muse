/**
 * src/metrics.ts
 *
 * Tiny in-process counters + latency reservoirs for operational visibility —
 * Last.fm cache hit rate, Tidal failover frequency, job outcomes, and per-route
 * request latency (p50/p95/p99). No external dependency; exposed as JSON at
 * GET /metrics. Replace with Prometheus/OpenTelemetry if this graduates beyond
 * single-node.
 */
const counters = new Map<string, number>();
const timings = new Map<string, number[]>();

const MAX_SAMPLES = 1000;

export function incr(name: string, by = 1): void {
	counters.set(name, (counters.get(name) ?? 0) + by);
}

/** Record a duration sample (milliseconds) under `name`. */
export function observe(name: string, ms: number): void {
	let series = timings.get(name);
	if (!series) {
		series = [];
		timings.set(name, series);
	}
	series.push(ms);
	if (series.length > MAX_SAMPLES) series.shift();
}

function quantile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
	return sorted[idx];
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Flat, alphabetically-sorted snapshot. Latency series are flattened into
 * `${name} p95_ms`-style numeric keys so the shape stays a Record<string, number>.
 */
export function snapshot(): Record<string, number> {
	const out: Record<string, number> = Object.fromEntries(counters);
	for (const [name, samples] of timings) {
		if (samples.length === 0) continue;
		const sorted = [...samples].sort((a, b) => a - b);
		const sum = sorted.reduce((a, b) => a + b, 0);
		out[`${name} count`] = sorted.length;
		out[`${name} avg_ms`] = round(sum / sorted.length);
		out[`${name} p50_ms`] = round(quantile(sorted, 0.5));
		out[`${name} p95_ms`] = round(quantile(sorted, 0.95));
		out[`${name} p99_ms`] = round(quantile(sorted, 0.99));
		out[`${name} max_ms`] = round(sorted[sorted.length - 1]);
	}
	return Object.fromEntries(
		Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
	);
}
