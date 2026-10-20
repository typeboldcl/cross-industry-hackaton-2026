import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "obligation_source" })
@Index("obligation_source_document_id_section_key_idx", [
  "documentId",
  "sectionKey",
])
@Index("obligation_source_obligation_version_id_idx", ["obligationVersionId"])
export class ObligationSourceEntity {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "obligation_source_pkey",
  })
  id: string;

  @Column({ name: "obligation_version_id", type: "uuid" })
  obligationVersionId: string;

  @Column({ name: "document_id", type: "uuid" })
  documentId: string;

  @Column({ name: "section_key", type: "text" })
  sectionKey: string;

  @Column({ type: "integer", nullable: true })
  page: number | null;

  @Column({ name: "char_start", type: "integer", nullable: true })
  charStart: number | null;

  @Column({ name: "char_end", type: "integer", nullable: true })
  charEnd: number | null;

  @Column({ type: "text" })
  quote: string;
}
