import type { QueryResponse } from "@hackaton/contracts";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import type { Section } from "../src/documents/sectioner.js";
import { ChunkEmbeddingService } from "../src/embeddings/chunk-embedding.service.js";
import type { FakeEmbeddingClient } from "../src/embeddings/fake-embedding-client.js";
import { sha256Hex } from "../src/llm/canonical-json.js";
import type { FakeLlm } from "../src/llm/fake-llm.js";
import { createTestApp } from "./app.js";

const QUESTION = "¿Con qué frecuencia se debe monitorear el efluente?";

function section(
  key: string,
  text: string,
  pageFrom: number,
  pageTo = pageFrom,
): Section {
  return {
    key,
    kind: key.startsWith("resuelvo") ? "resuelvo" : "considerando",
    title: "",
    text,
    pageFrom,
    pageTo,
    charStart: pageFrom * 1_000,
    charEnd: pageFrom * 1_000 + text.length,
    part: 1,
    partsTotal: 1,
  };
}

describe("facility query", () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let llm: FakeLlm;
  let embeddings: FakeEmbeddingClient;
  let chunks: ChunkEmbeddingService;
  let facilityId: string;
  let otherFacilityId: string;
  let rcaId: string;
  let otherRcaId: string;

  beforeAll(async () => {
    ({ app, llm, embeddings } = await createTestApp(() => ({
      text: "El efluente se monitorea mensualmente (considerando 7, pág. 12).",
      citations: [
        { documentId: rcaId, sectionKey: "considerando 7", page: 12 },
        { documentId: rcaId, sectionKey: "considerando 7", page: 12 },
        { documentId: rcaId, sectionKey: "considerando 99", page: 40 },
        { documentId: otherRcaId, sectionKey: "considerando 7", page: 3 },
      ],
    })));
    db = app.get(DataSource);
    chunks = app.get(ChunkEmbeddingService);

    facilityId = await insertFacility();
    otherFacilityId = await insertFacility();
    rcaId = await insertDocument(facilityId, "RCA Piscicultura Aucha");
    otherRcaId = await insertDocument(otherFacilityId, "RCA de otra planta");

    await chunks.embedSections({ id: rcaId }, [
      section(
        "considerando 7",
        "El titular deberá monitorear mensualmente el efluente de la piscicultura y reportar los resultados a la SMA.",
        12,
      ),
      section(
        "considerando 8",
        "Los residuos peligrosos se almacenarán en una bodega techada con piso impermeable.",
        13,
        14,
      ),
      section(
        "resuelvo 1",
        "El proyecto se ubica en la comuna de Calbuco, región de Los Lagos.",
        2,
      ),
    ]);
    await chunks.embedSections({ id: otherRcaId }, [
      section("considerando 7", QUESTION, 3),
    ]);
  });

  afterAll(async () => {
    await db.query(`DELETE FROM document WHERE id = ANY($1)`, [
      [rcaId, otherRcaId],
    ]);
    await db.query(`DELETE FROM facility WHERE id = ANY($1)`, [
      [facilityId, otherFacilityId],
    ]);
    await app.close();
  });

  async function insertFacility() {
    const [{ id }] = await db.query(
      `INSERT INTO facility (titular, kind, name, comuna) VALUES ('Titular de prueba', 'piscicultura', $1, 'Calbuco') RETURNING id`,
      [`query-test-${randomUUID()}`],
    );
    return id as string;
  }

  async function insertDocument(owner: string, title: string) {
    const sha256 = sha256Hex(randomUUID());
    const [{ id }] = await db.query(
      `INSERT INTO document (facility_id, sha256, storage_key, mime, kind, title, processing_status)
       VALUES ($1, $2, $3, 'application/pdf', 'rca', $4, 'done') RETURNING id`,
      [owner, sha256, `documents/${sha256}.pdf`, title],
    );
    return id as string;
  }

  function query(body: object, facility = facilityId) {
    return request(app.getHttpServer())
      .post(`/api/facilities/${facility}/query`)
      .send(body);
  }

  it("stores every section once with its model, hash and pages", async () => {
    const callsBefore = embeddings.calls.length;
    await chunks.embedSections({ id: rcaId }, [
      section("considerando 7", "texto que no debe reemplazar al original", 12),
    ]);
    expect(embeddings.calls.length).toBe(callsBefore);

    const rows: {
      section_key: string;
      model: string;
      text_sha256: string;
      text: string;
      page_from: number;
      page_to: number;
    }[] = await db.query(
      `SELECT section_key, model, text_sha256, text, page_from, page_to FROM document_chunk WHERE document_id = $1 ORDER BY section_key`,
      [rcaId],
    );
    expect(rows.map((row) => row.section_key)).toEqual([
      "considerando 7",
      "considerando 8",
      "resuelvo 1",
    ]);
    expect(rows.every((row) => row.model === embeddings.model)).toBe(true);
    expect(rows.every((row) => row.text_sha256 === sha256Hex(row.text))).toBe(
      true,
    );
    expect(rows[1]).toMatchObject({ page_from: 13, page_to: 14 });
    expect(embeddings.calls.every((call) => call.kind === "document")).toBe(
      true,
    );
  });

  it("logs and keeps going when the embedding service fails", async () => {
    const documentId = await insertDocument(facilityId, "Pertinencia");
    const embed = vi
      .spyOn(embeddings, "embed")
      .mockRejectedValueOnce(new Error("Ollama is down"));

    await expect(
      chunks.embedSections({ id: documentId }, [
        section("considerando 1", "Texto de la pertinencia.", 1),
      ]),
    ).resolves.toBeUndefined();
    embed.mockRestore();

    const [{ count }] = await db.query(
      `SELECT count(*)::int AS count FROM document_chunk WHERE document_id = $1`,
      [documentId],
    );
    expect(count).toBe(0);
    await db.query(`DELETE FROM document WHERE id = $1`, [documentId]);
  });

  it("ranks the facility's chunks by similarity and answers citing only retrieved chunks", async () => {
    const { body } = (await query({ question: QUESTION }).expect(200)) as {
      body: QueryResponse;
    };

    expect(body.chunks.map((chunk) => chunk.documentId)).toEqual([
      rcaId,
      rcaId,
      rcaId,
    ]);
    expect(body.chunks[0]).toMatchObject({
      sectionKey: "considerando 7",
      documentTitle: "RCA Piscicultura Aucha",
      pageFrom: 12,
      pageTo: 12,
      part: 1,
    });
    const scores = body.chunks.map((chunk) => chunk.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(scores[0]).toBeGreaterThan(0);
    expect(scores[0]).toBeLessThanOrEqual(1);

    expect(embeddings.calls.at(-1)).toEqual({
      texts: [QUESTION],
      kind: "query",
    });

    expect(body.answer?.text).toContain("mensualmente");
    expect(body.answer?.citations).toEqual([
      { documentId: rcaId, sectionKey: "considerando 7", page: 12 },
    ]);

    const prompt = llm.requests.at(-1)?.messages.at(-1)?.content ?? "";
    expect(prompt).toContain(QUESTION);
    expect(prompt).toContain("monitorear mensualmente el efluente");
    expect(prompt).not.toContain(otherRcaId);

    const [{ count }] = await db.query(
      `SELECT count(*)::int AS count FROM extraction_run WHERE kind = 'answer' AND prompt_version = 'answer-v1'`,
    );
    expect(count).toBe(1);
  });

  it("returns only topK chunks and skips the answer when not requested", async () => {
    const llmCalls = llm.requests.length;
    const { body } = (await query({
      question: QUESTION,
      topK: 1,
      answer: false,
    }).expect(200)) as { body: QueryResponse };

    expect(body.chunks).toHaveLength(1);
    expect(body.chunks[0]?.sectionKey).toBe("considerando 7");
    expect(body.answer).toBeNull();
    expect(llm.requests.length).toBe(llmCalls);
  });

  it("answers without the LLM when the facility has no chunks", async () => {
    const llmCalls = llm.requests.length;
    await db.query(`DELETE FROM document_chunk WHERE document_id = $1`, [
      otherRcaId,
    ]);

    const { body } = (await query(
      { question: QUESTION },
      otherFacilityId,
    ).expect(200)) as { body: QueryResponse };

    expect(body.chunks).toEqual([]);
    expect(body.answer?.citations).toEqual([]);
    expect(body.answer?.text).toMatch(/No encuentro/);
    expect(llm.requests.length).toBe(llmCalls);
  });

  it("validates the request", async () => {
    await query({ question: "   " }).expect(400);
    await query({ question: "x".repeat(2_001) }).expect(400);
    await query({ question: QUESTION, topK: 0 }).expect(400);
    await query({ question: QUESTION, topK: 21 }).expect(400);
    await query({ question: QUESTION }, randomUUID()).expect(404);
    await query({ question: QUESTION }, "not-a-uuid").expect(400);
  });
});
