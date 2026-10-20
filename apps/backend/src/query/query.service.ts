import type {
  QueryAnswer,
  QueryChunk,
  QueryRequest,
  QueryResponse,
} from "@hackaton/contracts";
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { ENV, type Env } from "../common/config/env.js";
import {
  EMBEDDING_CLIENT,
  type EmbeddingClient,
  toVectorLiteral,
} from "../embeddings/embedding-client.js";
import { sha256Hex } from "../llm/canonical-json.js";
import { LlmService } from "../llm/llm.service.js";
import {
  ANSWER_PROMPT_VERSION,
  ANSWER_SYSTEM_PROMPT,
  type AnswerOutput,
  answerOutputSchema,
  answerUserPrompt,
} from "./query.prompt.js";

const DEFAULT_TOP_K = 8;

const NOT_COVERED =
  "No encuentro esa información en los documentos de la instalación.";

interface ChunkRow {
  document_id: string;
  document_title: string;
  document_number: string | null;
  section_key: string;
  part: number;
  page_from: number;
  page_to: number;
  text: string;
  distance: number;
}

@Injectable()
export class QueryService {
  private readonly logger = new Logger("Query");

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(EMBEDDING_CLIENT) private readonly embeddings: EmbeddingClient,
    private readonly llm: LlmService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  async query(
    facilityId: string,
    request: QueryRequest,
  ): Promise<QueryResponse> {
    if (!this.env.embeddings.enabled) {
      throw new ServiceUnavailableException(
        "La búsqueda en los documentos está deshabilitada.",
      );
    }

    await this.assertFacility(facilityId);
    const chunks = await this.search(
      facilityId,
      request.question,
      request.topK ?? DEFAULT_TOP_K,
    );
    const answer =
      (request.answer ?? true)
        ? await this.answer(request.question, chunks)
        : null;

    return { chunks, answer };
  }

  private async assertFacility(facilityId: string): Promise<void> {
    const rows: unknown[] = await this.db.query(
      `SELECT 1 FROM facility WHERE id = $1`,
      [facilityId],
    );
    if (rows.length === 0) {
      throw new NotFoundException("Instalación no encontrada.");
    }
  }

  private async search(
    facilityId: string,
    question: string,
    topK: number,
  ): Promise<QueryChunk[]> {
    const vector = await this.embedQuestion(question);

    const rows = await this.db.transaction(async (manager) => {
      // Without iterative scans the HNSW index yields only ef_search candidates before the facility filter, so a facility with few chunks would get fewer than topK.
      await manager.query(`SET LOCAL hnsw.iterative_scan = strict_order`);
      return (await manager.query(
        `SELECT c.document_id, d.title AS document_title, d.number AS document_number,
                c.section_key, c.part, c.page_from, c.page_to, c.text,
                c.embedding <=> $2::vector AS distance
         FROM document_chunk c
         JOIN document d ON d.id = c.document_id
         WHERE d.facility_id = $1 AND c.model = $3
         ORDER BY c.embedding <=> $2::vector
         LIMIT $4`,
        [facilityId, toVectorLiteral(vector), this.embeddings.model, topK],
      )) as ChunkRow[];
    });

    return rows.map((row) => ({
      documentId: row.document_id,
      documentTitle: row.document_title,
      documentNumber: row.document_number,
      sectionKey: row.section_key,
      part: row.part,
      pageFrom: row.page_from,
      pageTo: row.page_to,
      text: row.text,
      score: 1 - Number(row.distance),
    }));
  }

  private async embedQuestion(question: string): Promise<number[]> {
    try {
      const [vector] = await this.embeddings.embed([question], "query");
      if (!vector) throw new Error("the embedding client returned no vector");
      return vector;
    } catch (error) {
      this.logger.warn(
        `question embedding failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        "El servicio de búsqueda no está disponible. Inténtalo de nuevo en unos minutos.",
      );
    }
  }

  private async answer(
    question: string,
    chunks: QueryChunk[],
  ): Promise<QueryAnswer> {
    if (chunks.length === 0) return { text: NOT_COVERED, citations: [] };

    let output: AnswerOutput;
    try {
      ({ output } = await this.llm.run({
        kind: "answer",
        model: this.env.llm.largeModel,
        promptVersion: ANSWER_PROMPT_VERSION,
        system: ANSWER_SYSTEM_PROMPT,
        user: answerUserPrompt(question, chunks),
        input: {
          question,
          chunks: chunks.map((chunk) => ({
            documentId: chunk.documentId,
            sectionKey: chunk.sectionKey,
            part: chunk.part,
            textSha256: sha256Hex(chunk.text),
          })),
        },
        schema: answerOutputSchema,
      }));
    } catch (error) {
      this.logger.warn(
        `answer failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadGatewayException(
        "No se pudo generar la respuesta. Inténtalo de nuevo en unos minutos.",
      );
    }

    return { text: output.text, citations: retrievedCitations(output, chunks) };
  }
}

function retrievedCitations(
  output: AnswerOutput,
  chunks: QueryChunk[],
): QueryAnswer["citations"] {
  const retrieved = new Set(
    chunks.map((chunk) => citationKey(chunk.documentId, chunk.sectionKey)),
  );
  const seen = new Set<string>();

  return output.citations.filter((citation) => {
    const source = citationKey(citation.documentId, citation.sectionKey);
    const unique = `${source}\u0000${citation.page}`;
    if (!retrieved.has(source) || seen.has(unique)) return false;
    seen.add(unique);
    return true;
  });
}

function citationKey(documentId: string, sectionKey: string): string {
  return `${documentId}\u0000${sectionKey}`;
}
