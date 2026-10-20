import type { AuditStatus } from "@hackaton/contracts";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "audit" })
@Index("audit_facility_id_idx", ["facilityId"])
export class AuditEntity {
  @PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "audit_pkey" })
  id: string;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;

  @Column({ name: "authority_id", type: "uuid" })
  authorityId: string;

  @Column({ type: "text" })
  kind: string;

  @Column({ name: "period_from", type: "date", nullable: true })
  periodFrom: string | null;

  @Column({ name: "period_to", type: "date", nullable: true })
  periodTo: string | null;

  @Column({ type: "text", default: "planned" })
  status: AuditStatus;

  @Column({ name: "planned_on", type: "date", nullable: true })
  plannedOn: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
