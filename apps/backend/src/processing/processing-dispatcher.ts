import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { DocumentPipeline } from "./document-pipeline.js";

export const PROCESSING_DISPATCHER = Symbol("PROCESSING_DISPATCHER");

export interface ProcessingDispatcher {
  dispatch(documentId: string): Promise<void>;
}

@Injectable()
export class InlineDispatcher
  implements ProcessingDispatcher, OnApplicationBootstrap
{
  private readonly logger = new Logger("Dispatcher");

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly pipeline: DocumentPipeline,
  ) {}

  async dispatch(documentId: string): Promise<void> {
    await this.db.query(
      `UPDATE document SET processing_status = 'queued' WHERE id = $1 AND processing_status <> 'processing'`,
      [documentId],
    );
    this.start(documentId);
  }

  // A single replica runs the pipeline in-process, so whatever was mid-run when the process stopped is picked up again here.
  async onApplicationBootstrap(): Promise<void> {
    const [rows] = await this.db.query(
      `UPDATE document SET processing_status = 'queued'
       WHERE processing_status IN ('queued', 'processing')
       RETURNING id`,
    );
    for (const { id } of (rows as { id: string }[] | undefined) ?? []) {
      this.logger.log(`Resuming ${id}`);
      this.start(id);
    }
  }

  private start(documentId: string): void {
    void this.pipeline.run(documentId).catch((error: unknown) => {
      this.logger.error(
        `${documentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }
}
