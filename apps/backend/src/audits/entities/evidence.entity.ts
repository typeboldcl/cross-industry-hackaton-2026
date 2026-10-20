import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity({ name: "evidence" })
@Unique("evidence_client_id_key", ["clientId"])
@Index("evidence_audit_item_id_idx", ["auditItemId"])
export class EvidenceEntity {
  @PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "evidence_pkey" })
  id: string;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;

  @Column({ name: "obligation_id", type: "uuid" })
  obligationId: string;

  @Column({ name: "audit_item_id", type: "uuid", nullable: true })
  auditItemId: string | null;

  @Column({ type: "text" })
  sha256: string;

  @Column({ name: "storage_key", type: "text" })
  storageKey: string;

  @Column({ type: "text" })
  mime: string;

  @Column({ name: "captured_at", type: "timestamptz", nullable: true })
  capturedAt: Date | null;

  @Column({ name: "client_id", type: "uuid" })
  clientId: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
