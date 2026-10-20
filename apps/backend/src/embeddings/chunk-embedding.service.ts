import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { ENV, type Env } from "../common/config/env.js";
import type { DocumentEntity } from "../documents/entities/document.entity.js";
import type { Section } from "../documents/sectioner.js";
import { sha256Hex } from "../llm/canonical-json.js";
import {
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_CLIENT,
  type EmbeddingClient,
  toVectorLiteral,
} from "./embedding-client.js";

const COLUMNS_PER_ROW = 11;

@Injectable()
export class ChunkEmbeddingService {
  private readonly logger = new Logger("Embeddings");

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(EMBEDDING_CLIENT) private readonly client: EmbeddingClient,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  async embedSections(
    document: Pick<DocumentEntity, "id">,
    sections: Section[],
  ): Promise<void> {
    if (!this.env.embeddings.enabled || sections.length === 0) return;

    try {
      const inserted = await this.store(document.id, sections);
      if (inserted > 0) {
        this.logger.log(`${document.id}: embedded ${inserted} chunks`);
      }
    } catch (error) {
      this.logger.warn(
        `${document.id}: embedding stopped, Q&A will miss the remaining chunks (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  private async store(documentId: string, sections: Section[]) {
    const pending = await this.pendingSections(documentId, sections);
    let inserted = 0;

    for (let start = 0; start < pending.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = pending.slice(start, start + EMBEDDING_BATCH_SIZE);
      const vectors = await this.client.embed(
        batch.map((section) => section.text),
        "document",
      );
      inserted += await this.insert(documentId, batch, vectors);
    }

    return inserted;
  }

  private async pendingSections(
    documentId: string,
    sections: Section[],
  ): Promise<Section[]> {
    const rows: { section_key: string; part: number }[] = await this.db.query(
      `SELECT section_key, part FROM document_chunk WHERE document_id = $1 AND model = $2`,
      [documentId, this.client.model],
    );
    const seen = new Set(
      rows.map((row) => chunkKey(row.section_key, row.part)),
    );

    return sections.filter((section) => {
      const key = chunkKey(section.key, section.part);
      if (seen.has(key) || section.text.trim() === "") return false;
      seen.add(key);
      return true;
    });
  }

  private async insert(
    documentId: string,
    sections: Section[],
    vectors: number[][],
  ): Promise<number> {
    const parameters: unknown[] = [];
    const values = sections.map((section, index) => {
      parameters.push(
        documentId,
        section.key,
        section.part,
        section.text,
        sha256Hex(section.text),
        section.pageFrom,
        section.pageTo,
        section.charStart,
        section.charEnd,
        this.client.model,
        toVectorLiteral(vectors[index]!),
      );
      const offset = index * COLUMNS_PER_ROW;
      const placeholders = Array.from(
        { length: COLUMNS_PER_ROW },
        (_, column) => `$${offset + column + 1}`,
      );
      placeholders[COLUMNS_PER_ROW - 1] += "::vector";
      return `(${placeholders.join(", ")})`;
    });

    const rows: unknown[] = await this.db.query(
      `INSERT INTO document_chunk (document_id, section_key, part, text, text_sha256, page_from, page_to, char_start, char_end, model, embedding)
       VALUES ${values.join(", ")}
       ON CONFLICT ON CONSTRAINT document_chunk_section_part_model_key DO NOTHING
       RETURNING id`,
      parameters,
    );
    return rows.length;
  }
}

function chunkKey(sectionKey: string, part: number): string {
  return `${sectionKey}#${part}`;
}
