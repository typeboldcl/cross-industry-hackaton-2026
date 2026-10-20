import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

export type ExtractionRunKind = "detect_ids" | "extract" | "amend" | "answer";

@Entity({ name: "extraction_run" })
@Unique("extraction_run_input_fingerprint_key", ["inputFingerprint"])
export class ExtractionRunEntity {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "extraction_run_pkey",
  })
  id: string;

  @Column({ type: "text" })
  kind: ExtractionRunKind;

  @Column({ type: "text" })
  model: string;

  @Column({ name: "prompt_version", type: "text" })
  promptVersion: string;

  @Column({ name: "input_fingerprint", type: "text" })
  inputFingerprint: string;

  @Column({ type: "jsonb" })
  input: unknown;

  @Column({ type: "jsonb" })
  output: unknown;

  @Column({ name: "tokens_in", type: "integer", nullable: true })
  tokensIn: number | null;

  @Column({ name: "tokens_out", type: "integer", nullable: true })
  tokensOut: number | null;

  @Column({
    name: "cost_usd",
    type: "numeric",
    precision: 12,
    scale: 6,
    nullable: true,
  })
  costUsd: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
