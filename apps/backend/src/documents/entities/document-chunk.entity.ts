import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity({ name: "document_chunk" })
@Unique("document_chunk_section_part_model_key", [
  "documentId",
  "sectionKey",
  "part",
  "model",
])
export class DocumentChunkEntity {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "document_chunk_pkey",
  })
  id: string;

  @Column({ name: "document_id", type: "uuid" })
  documentId: string;

  @Column({ name: "section_key", type: "text" })
  sectionKey: string;

  @Column({ type: "integer", default: 1 })
  part: number;

  @Column({ type: "text" })
  text: string;

  @Column({ name: "text_sha256", type: "text" })
  textSha256: string;

  @Column({ name: "page_from", type: "integer" })
  pageFrom: number;

  @Column({ name: "page_to", type: "integer" })
  pageTo: number;

  @Column({ name: "char_start", type: "integer" })
  charStart: number;

  @Column({ name: "char_end", type: "integer" })
  charEnd: number;

  @Column({ type: "text" })
  model: string;

  @Column({ type: "vector", length: 1024 })
  embedding: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
