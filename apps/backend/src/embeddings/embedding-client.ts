export const EMBEDDING_CLIENT = Symbol("EMBEDDING_CLIENT");

export const EMBEDDING_DIMENSIONS = 1024;

export const EMBEDDING_BATCH_SIZE = 16;

export type EmbeddingKind = "document" | "query";

export interface EmbeddingClient {
  readonly model: string;
  embed(texts: string[], kind: EmbeddingKind): Promise<number[][]>;
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
