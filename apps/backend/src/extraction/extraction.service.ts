import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import { ENV, type Env } from "../common/config/env.js";
import type { DocumentEntity } from "../documents/entities/document.entity.js";
import type { Section } from "../documents/sectioner.js";
import { sha256Hex } from "../llm/canonical-json.js";
import { LlmService } from "../llm/llm.service.js";
import {
  EXTRACT_PROMPT_VERSION,
  EXTRACT_SYSTEM_PROMPT,
  type ExtractedObligation,
  extractionOutputSchema,
  extractUserPrompt,
} from "./extraction.prompt.js";
import { locateQuote } from "./quote-locator.js";

const DEFAULT_AUTHORITY: Record<string, string> = {
  res_sanitaria: "SEREMI_SALUD",
};

export interface SectionExtractionResult {
  draftsCreated: number;
  cached: boolean;
}

@Injectable()
export class ExtractionService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly llm: LlmService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  async extractSection(
    document: DocumentEntity,
    section: Section,
  ): Promise<SectionExtractionResult> {
    const { runId, output, cached } = await this.llm.run({
      kind: "extract",
      model: this.env.llm.largeModel,
      promptVersion: EXTRACT_PROMPT_VERSION,
      system: EXTRACT_SYSTEM_PROMPT,
      user: extractUserPrompt({
        documentKind: document.kind,
        documentNumber: document.number,
        documentTitle: document.title,
        sectionKey: section.key,
        sectionTitle: section.title,
        part: section.part,
        partsTotal: section.partsTotal,
        text: section.text,
      }),
      input: {
        documentSha256: document.sha256,
        sectionKey: section.key,
        part: section.part,
        textSha256: sha256Hex(section.text),
      },
      schema: extractionOutputSchema,
    });

    const draftsCreated = await this.db.transaction((manager) =>
      this.saveDrafts(manager, document, section, runId, output.obligations),
    );

    return { draftsCreated, cached };
  }

  private async saveDrafts(
    manager: EntityManager,
    document: DocumentEntity,
    section: Section,
    runId: string,
    obligations: ExtractedObligation[],
  ): Promise<number> {
    const authorityIds = await this.authorityIds(manager);
    let created = 0;

    for (const [index, extracted] of obligations.entries()) {
      const ordinal =
        section.partsTotal > 1
          ? `${section.part}.${index + 1}`
          : `${index + 1}`;
      const key = `${document.kind}-${document.sha256.slice(0, 8)}/${section.key}/${ordinal}`;
      const authorityCode =
        extracted.authorityCode ?? DEFAULT_AUTHORITY[document.kind] ?? "SMA";
      const authorityId =
        authorityIds.get(authorityCode) ?? authorityIds.get("SMA");

      const [obligation] = await manager.query(
        `INSERT INTO obligation (facility_id, authority_id, category, key)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (facility_id, key) DO UPDATE SET key = EXCLUDED.key
         RETURNING id`,
        [document.facilityId, authorityId, extracted.category, key],
      );

      const inserted = await manager.query(
        `INSERT INTO obligation_version
           (obligation_id, seq, title, body, phase, frequency, expected_evidence, due_date, attributes, status, caused_by_document_id, extraction_run_id)
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $10)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          obligation.id,
          extracted.title,
          extracted.body,
          extracted.phase ?? null,
          extracted.frequency ?? null,
          extracted.expectedEvidence ?? null,
          extracted.dueDate ?? null,
          JSON.stringify(extracted.attributes ?? {}),
          document.id,
          runId,
        ],
      );

      const versionId = inserted[0]?.id as string | undefined;
      if (!versionId) continue;

      const location = locateQuote(section.text, extracted.quote);
      const page = location
        ? section.pageFrom + countPageBreaks(section.text, location.start)
        : null;

      await manager.query(
        `INSERT INTO obligation_source (obligation_version_id, document_id, section_key, page, char_start, char_end, quote)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          versionId,
          document.id,
          section.key,
          page,
          location ? section.charStart + location.start : null,
          location ? section.charStart + location.end : null,
          extracted.quote,
        ],
      );
      created += 1;
    }

    return created;
  }

  private async authorityIds(
    manager: EntityManager,
  ): Promise<Map<string, string>> {
    const rows: { id: string; code: string }[] = await manager.query(
      `SELECT id, code FROM authority`,
    );
    return new Map(rows.map((row) => [row.code, row.id]));
  }
}

function countPageBreaks(text: string, until: number): number {
  let count = 0;
  for (
    let i = text.indexOf("\f");
    i !== -1 && i < until;
    i = text.indexOf("\f", i + 1)
  ) {
    count += 1;
  }
  return count;
}
