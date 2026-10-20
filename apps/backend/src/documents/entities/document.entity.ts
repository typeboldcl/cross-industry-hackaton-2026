import type { DocumentKind } from "@hackaton/contracts";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

export type DocumentOrigin = "uploaded" | "fetched";

export type ProcessingStatus =
  "uploaded" | "queued" | "processing" | "done" | "failed";

@Entity({ name: "document" })
@Unique("document_sha256_key", ["sha256"])
@Index("document_facility_id_idx", ["facilityId"])
export class DocumentEntity {
  @PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "document_pkey" })
  id: string;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;

  @Column({ type: "text", nullable: true })
  number: string | null;

  @Column({ type: "text" })
  sha256: string;

  @Column({ name: "storage_key", type: "text" })
  storageKey: string;

  @Column({ type: "text" })
  mime: string;

  @Column({ type: "text" })
  kind: DocumentKind;

  @Column({ name: "issuer_id", type: "uuid", nullable: true })
  issuerId: string | null;

  @Column({ type: "text" })
  title: string;

  @Column({ name: "issued_on", type: "date", nullable: true })
  issuedOn: string | null;

  @Column({ type: "text", default: "uploaded" })
  origin: DocumentOrigin;

  @Column({ name: "source_url", type: "text", nullable: true })
  sourceUrl: string | null;

  @Column({ name: "processing_status", type: "text", default: "uploaded" })
  processingStatus: ProcessingStatus;

  @Column({ name: "sections_total", type: "integer", default: 0 })
  sectionsTotal: number;

  @Column({ name: "sections_done", type: "integer", default: 0 })
  sectionsDone: number;

  @Column({ name: "processing_error", type: "text", nullable: true })
  processingError: string | null;

  @Column({ name: "processed_at", type: "timestamptz", nullable: true })
  processedAt: Date | null;

  @Column({ name: "text_extracted_at", type: "timestamptz", nullable: true })
  textExtractedAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
