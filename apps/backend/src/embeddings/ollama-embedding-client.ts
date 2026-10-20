import type { EmbeddingSettings } from "../common/config/env.js";
import {
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  type EmbeddingClient,
  type EmbeddingKind,
} from "./embedding-client.js";

const TIMEOUT_MS = 60_000;

// Qwen3-Embedding is trained with an instruction on the query side only; documents are embedded as plain text.
export const QUERY_INSTRUCTION =
  "Instruct: Given a question about environmental compliance obligations, retrieve the passages of the permit that answer it\nQuery: ";

interface EmbedResponse {
  embeddings?: unknown;
}

export class OllamaEmbeddingClient implements EmbeddingClient {
  readonly model: string;
  private readonly endpoint: string;

  constructor(
    settings: Pick<EmbeddingSettings, "baseUrl" | "model">,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    this.model = settings.model;
    this.endpoint = `${settings.baseUrl.replace(/\/+$/, "")}/api/embed`;
  }

  async embed(texts: string[], kind: EmbeddingKind): Promise<number[][]> {
    const input =
      kind === "query" ? texts.map((text) => QUERY_INSTRUCTION + text) : texts;
    const vectors: number[][] = [];

    for (let start = 0; start < input.length; start += EMBEDDING_BATCH_SIZE) {
      vectors.push(
        ...(await this.embedBatch(
          input.slice(start, start + EMBEDDING_BATCH_SIZE),
        )),
      );
    }

    return vectors;
  }

  private async embedBatch(input: string[]): Promise<number[][]> {
    const response = await this.fetchFn(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, input }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(
        `Ollama embed failed with ${response.status}: ${detail || response.statusText}`,
      );
    }

    const { embeddings } = (await response.json()) as EmbedResponse;

    if (
      !Array.isArray(embeddings) ||
      embeddings.length !== input.length ||
      !embeddings.every(isVector)
    ) {
      throw new Error(
        `Ollama returned ${Array.isArray(embeddings) ? embeddings.length : "no"} embeddings for ${input.length} inputs, expected ${EMBEDDING_DIMENSIONS}-dimension vectors from ${this.model}.`,
      );
    }

    return embeddings;
  }
}

function isVector(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === EMBEDDING_DIMENSIONS &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}
