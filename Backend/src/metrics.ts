/**
 * src/metrics.ts
 *
 * Tiny in-process counters for operational visibility — Last.fm cache hit rate,
 * Tidal failover frequency, job outcomes. No external dependency; exposed as
 * JSON at GET /metrics. Replace with Prometheus/OpenTelemetry if this graduates
 * beyond single-node.
 */
const counters = new Map<string, number>();

export function incr(name: string, by = 1): void {
	counters.set(name, (counters.get(name) ?? 0) + by);
}

export function snapshot(): Record<string, number> {
	return Object.fromEntries([...counters.entries()].sort());
}
