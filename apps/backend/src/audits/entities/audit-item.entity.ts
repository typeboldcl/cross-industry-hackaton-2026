import type { AuditResult, NaReason } from "@hackaton/contracts";
import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "audit_item" })
@Unique("audit_item_audit_id_obligation_version_id_key", [
  "auditId",
  "obligationVersionId",
])
export class AuditItemEntity {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "audit_item_pkey",
  })
  id: string;

  @Column({ name: "audit_id", type: "uuid" })
  auditId: string;

  @Column({ name: "obligation_version_id", type: "uuid" })
  obligationVersionId: string;

  @Column({ type: "integer", default: 0 })
  position: number;

  @Column({ type: "text", default: "pending" })
  result: AuditResult;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ name: "na_reason", type: "text", nullable: true })
  naReason: NaReason | null;

  @Column({ name: "assessed_by_name", type: "text", nullable: true })
  assessedByName: string | null;

  @Column({ name: "assessed_at", type: "timestamptz", nullable: true })
  assessedAt: Date | null;
}
