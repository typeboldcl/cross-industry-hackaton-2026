import type { AuditKind, AuditStatus } from "@hackaton/contracts";
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

  @Column({ name: "authority_id", type: "uuid", nullable: true })
  authorityId: string | null;

  @Column({ type: "text", default: "" })
  title: string;

  @Column({ type: "text" })
  kind: AuditKind;

  @Column({ name: "period_from", type: "date", nullable: true })
  periodFrom: string | null;

  @Column({ name: "period_to", type: "date", nullable: true })
  periodTo: string | null;

  @Column({ type: "text", default: "draft" })
  status: AuditStatus;

  @Column({ name: "planned_on", type: "date", nullable: true })
  plannedOn: string | null;

  @Column({ name: "created_by_name", type: "text", nullable: true })
  createdByName: string | null;

  @Column({ name: "validated_by_name", type: "text", nullable: true })
  validatedByName: string | null;

  @Column({ name: "published_at", type: "timestamptz", nullable: true })
  publishedAt: Date | null;

  @Column({ name: "closed_at", type: "timestamptz", nullable: true })
  closedAt: Date | null;

  @Column({
    name: "excluded_categories",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  excludedCategories: string[];

  @Column({ name: "client_id", type: "uuid", nullable: true })
  clientId: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
