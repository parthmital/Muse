/**
 * src/services/embeddingClient.ts
 * HTTP client for the Python embedding + FAISS microservice.
 *
 * Python service endpoints:
 *   POST /embed          – embed single text → number[]
 *   POST /embed/batch    – embed many texts → number[][]
 *   POST /search         – FAISS ANN search by vector → [{id, score}]
 *   POST /upsert         – add/update single vector in index
 *   POST /rebuild        – full FAISS rebuild from {id: vector} map
 *   GET  /health         – {"status":"ok","device":"cuda"|"cpu","index_size":N}
 */

import axios, { AxiosInstance } from "axios";
import { config } from "../config.js";

export interface SearchResult {
	id: string;
	score: number;
}

export interface EmbeddingServiceHealth {
	status: string;
	device: "cuda" | "cpu";
	index_size: number;
}

class EmbeddingClient {
	private http: AxiosInstance;

	constructor() {
		this.http = axios.create({
			baseURL: config.embeddingServiceUrl,
			timeout: 30_000,
		});
	}

	async embed(text: string): Promise<number[]> {
		const { data } = await this.http.post<{ embedding: number[] }>("/embed", {
			text,
		});
		return data.embedding;
	}

	async embedBatch(texts: string[]): Promise<number[][]> {
		const { data } = await this.http.post<{ embeddings: number[][] }>(
			"/embed/batch",
			{ texts },
		);
		return data.embeddings;
	}

	/** Build metadata text for embedding: captures genre/mood semantics without audio */
	buildText(
		title: string,
		artist: string,
		genre?: string | null,
		tags?: string[],
	): string {
		const tagStr = (tags ?? []).slice(0, 8).join(", ");
		return `${title} by ${artist}. Genre: ${genre ?? ""}. Tags: ${tagStr}`.trim();
	}

	async search(
		vector: number[],
		k: number,
		excludeIds?: string[],
	): Promise<SearchResult[]> {
		const { data } = await this.http.post<{ results: SearchResult[] }>(
			"/search",
			{
				vector,
				k,
				exclude_ids: excludeIds ?? [],
			},
		);
		return data.results;
	}

	async upsert(id: string, vector: number[]): Promise<void> {
		await this.http.post("/upsert", { id, vector });
	}

	async rebuild(vectors: Record<string, number[]>): Promise<void> {
		await this.http.post("/rebuild", { vectors });
	}

	async health(): Promise<EmbeddingServiceHealth | null> {
		try {
			const { data } = await this.http.get<EmbeddingServiceHealth>("/health");
			return data;
		} catch {
			return null;
		}
	}
}

export const embeddingClient = new EmbeddingClient();
