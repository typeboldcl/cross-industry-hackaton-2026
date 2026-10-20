import { createHash } from "node:crypto";
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingClient,
  type EmbeddingKind,
} from "./embedding-client.js";

// Hashes each word into a bucket, so texts that share words are close and tests can predict the ranking.
export class FakeEmbeddingClient implements EmbeddingClient {
  readonly model = "fake-embedding";
  readonly calls: { texts: string[]; kind: EmbeddingKind }[] = [];

  async embed(texts: string[], kind: EmbeddingKind): Promise<number[][]> {
    this.calls.push({ texts, kind });
    return texts.map(fakeVector);
  }
}

export function fakeVector(text: string): number[] {
  const vector = Array.from<number>({ length: EMBEDDING_DIMENSIONS }).fill(0);
  const words = text.toLowerCase().match(/\p{L}+|\d+/gu) ?? [text];

  for (const word of words) {
    vector[bucketOf(word)]! += 1;
  }

  const norm = Math.hypot(...vector);
  return vector.map((value) => value / norm);
}

function bucketOf(word: string): number {
  return (
    createHash("sha256").update(word).digest().readUInt32BE(0) %
    EMBEDDING_DIMENSIONS
  );
}
