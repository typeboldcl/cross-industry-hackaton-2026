import { EMBEDDING_DIMENSIONS } from "./embedding-client.js";
import {
  OllamaEmbeddingClient,
  QUERY_INSTRUCTION,
} from "./ollama-embedding-client.js";

const settings = {
  baseUrl: "http://ollama:11434/",
  model: "qwen3-embedding:0.6b",
};

function vectorFor(text: string): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => text.length);
}

function ollamaFetch() {
  return vi.fn<typeof fetch>(async (_url, init) => {
    const { input } = JSON.parse(init?.body as string) as { input: string[] };
    return Response.json({ embeddings: input.map(vectorFor) });
  });
}

function sentBodies(fetchFn: ReturnType<typeof ollamaFetch>) {
  return fetchFn.mock.calls.map(
    ([, init]) =>
      JSON.parse(init?.body as string) as { model: string; input: string[] },
  );
}

describe("OllamaEmbeddingClient", () => {
  it("embeds documents in batches of 16 without a prefix, keeping order", async () => {
    const fetchFn = ollamaFetch();
    const client = new OllamaEmbeddingClient(settings, fetchFn);
    const texts = Array.from({ length: 35 }, (_, index) => "x".repeat(index));

    const vectors = await client.embed(texts, "document");

    const bodies = sentBodies(fetchFn);
    expect(bodies.map((body) => body.input.length)).toEqual([16, 16, 3]);
    expect(bodies.every((body) => body.model === settings.model)).toBe(true);
    expect(bodies.flatMap((body) => body.input)).toEqual(texts);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://ollama:11434/api/embed");
    expect(fetchFn.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(vectors.map((vector) => vector[0])).toEqual(
      texts.map((text) => text.length),
    );
  });

  it("prefixes queries with the Qwen3 instruction", async () => {
    const fetchFn = ollamaFetch();
    const client = new OllamaEmbeddingClient(settings, fetchFn);

    await client.embed(["¿Cada cuánto se monitorea el efluente?"], "query");

    expect(sentBodies(fetchFn)[0]?.input).toEqual([
      "Instruct: Given a question about environmental compliance obligations, retrieve the passages of the permit that answer it\nQuery: ¿Cada cuánto se monitorea el efluente?",
    ]);
    expect(QUERY_INSTRUCTION.endsWith("\nQuery: ")).toBe(true);
  });

  it("fails on an HTTP error with Ollama's message", async () => {
    const fetchFn = vi.fn<typeof fetch>(
      async () => new Response('{"error":"model not found"}', { status: 404 }),
    );
    const client = new OllamaEmbeddingClient(settings, fetchFn);

    await expect(client.embed(["texto"], "document")).rejects.toThrow(
      /404.*model not found/,
    );
  });

  it("rejects vectors of the wrong size", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      Response.json({ embeddings: [[0.1, 0.2]] }),
    );
    const client = new OllamaEmbeddingClient(settings, fetchFn);

    await expect(client.embed(["texto"], "document")).rejects.toThrow(
      /1024-dimension/,
    );
  });

  it("does not call Ollama for an empty input", async () => {
    const fetchFn = ollamaFetch();
    const client = new OllamaEmbeddingClient(settings, fetchFn);

    expect(await client.embed([], "document")).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
