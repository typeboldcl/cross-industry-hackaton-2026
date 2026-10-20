import type { ObligationStatus, Phase } from "@hackaton/contracts";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity({ name: "obligation_version" })
@Unique("obligation_version_obligation_id_seq_key", ["obligationId", "seq"])
@Unique("obligation_version_extraction_run_id_obligation_id_key", [
  "extractionRunId",
  "obligationId",
])
export class ObligationVersionEntity {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "obligation_version_pkey",
  })
  id: string;

  @Column({ name: "obligation_id", type: "uuid" })
  obligationId: string;

  @Column({ type: "integer" })
  seq: number;

  @Column({ type: "text" })
  title: string;

  @Column({ type: "text" })
  body: string;

  @Column({ type: "text", nullable: true })
  phase: Phase | null;

  @Column({ type: "text", nullable: true })
  frequency: string | null;

  @Column({ name: "expected_evidence", type: "text", nullable: true })
  expectedEvidence: string | null;

  @Column({ name: "due_date", type: "date", nullable: true })
  dueDate: string | null;

  @Column({ name: "due_rule", type: "jsonb", nullable: true })
  dueRule: Record<string, unknown> | null;

  @Column({ type: "jsonb", default: () => "'{}'" })
  attributes: Record<string, unknown>;

  @Column({ name: "amendment_note", type: "text", nullable: true })
  amendmentNote: string | null;

  @Column({ type: "boolean", default: false })
  edited: boolean;

  @Column({ type: "text", default: "draft" })
  status: ObligationStatus;

  @Column({ name: "validated_by", type: "text", nullable: true })
  validatedBy: string | null;

  @Column({ name: "validated_at", type: "timestamptz", nullable: true })
  validatedAt: Date | null;

  @Column({ name: "valid_from", type: "timestamptz", nullable: true })
  validFrom: Date | null;

  @Column({ name: "valid_to", type: "timestamptz", nullable: true })
  validTo: Date | null;

  @Column({ name: "supersedes_id", type: "uuid", nullable: true })
  supersedesId: string | null;

  @Column({ name: "caused_by_document_id", type: "uuid", nullable: true })
  causedByDocumentId: string | null;

  @Column({ name: "extraction_run_id", type: "uuid", nullable: true })
  extractionRunId: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
