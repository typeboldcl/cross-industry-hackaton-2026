import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { numberFromText } from "../documents/document-number.js";
import { DocumentEntity } from "../documents/entities/document.entity.js";
import { extractPages } from "../documents/pdf-text.js";
import { filterSections } from "../documents/section-filter.js";
import { sectionDocument } from "../documents/sectioner.js";
import { ExtractionService } from "../extraction/extraction.service.js";
import { STORAGE, type StorageService } from "../storage/storage.service.js";

@Injectable()
export class DocumentPipeline {
  private readonly logger = new Logger("Pipeline");

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(STORAGE) private readonly storage: StorageService,
    private readonly extraction: ExtractionService,
  ) {}

  async run(documentId: string): Promise<void> {
    const document = await this.claim(documentId);
    if (!document) return;

    try {
      const pages = await this.pagesOf(document);
      const number = document.number ?? numberFromText(pages);
      const sections = filterSections(document.kind, sectionDocument(pages));

      await this.db.query(
        `UPDATE document SET number = $2, sections_total = $3, sections_done = 0, text_extracted_at = now() WHERE id = $1`,
        [document.id, number, sections.length],
      );
      document.number = number;

      const failures: string[] = [];
      await Promise.all(
        sections.map(async (section) => {
          try {
            await this.extraction.extractSection(document, section);
          } catch (error) {
            failures.push(`${section.key}#${section.part}`);
            this.logger.warn(
              `${document.id} ${section.key}#${section.part}: ${error instanceof Error ? error.message : String(error)}`,
            );
          } finally {
            await this.db.query(
              `UPDATE document SET sections_done = sections_done + 1 WHERE id = $1`,
              [document.id],
            );
          }
        }),
      );

      if (failures.length > 0) {
        throw new Error(
          `${failures.length} of ${sections.length} sections failed (${failures.slice(0, 5).join(", ")}). Re-run to retry only those.`,
        );
      }

      await this.db.query(
        `UPDATE document SET processing_status = 'done', processing_error = NULL, processed_at = now() WHERE id = $1`,
        [document.id],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${document.id}: ${message}`);
      await this.db.query(
        `UPDATE document SET processing_status = 'failed', processing_error = $2 WHERE id = $1`,
        [document.id, message.slice(0, 2_000)],
      );
    }
  }

  private async claim(documentId: string): Promise<DocumentEntity | null> {
    const [rows] = await this.db.query(
      `UPDATE document SET processing_status = 'processing', processing_error = NULL
       WHERE id = $1 AND processing_status IN ('uploaded', 'queued', 'failed')
       RETURNING id`,
      [documentId],
    );
    const claimed = (rows as { id: string }[] | undefined)?.length ?? 0;
    if (claimed === 0) return null;

    return this.db
      .getRepository(DocumentEntity)
      .findOneByOrFail({ id: documentId });
  }

  private async pagesOf(document: DocumentEntity): Promise<string[]> {
    const textKey = `text/${document.sha256}.pages.json`;

    if (await this.storage.exists(textKey)) {
      const cached = await this.storage.get(textKey);
      return (JSON.parse(cached.body.toString("utf8")) as { pages: string[] })
        .pages;
    }

    const pdf = await this.storage.get(document.storageKey);
    const pages = await extractPages(pdf.body);
    await this.storage.put(
      textKey,
      Buffer.from(JSON.stringify({ pages })),
      "application/json",
    );
    return pages;
  }
}
