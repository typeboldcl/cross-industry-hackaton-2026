import type { ObligationOrigin } from "@hackaton/contracts";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity({ name: "obligation" })
@Unique("obligation_facility_id_key_key", ["facilityId", "key"])
export class ObligationEntity {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "obligation_pkey",
  })
  id: string;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;

  @Column({ name: "authority_id", type: "uuid" })
  authorityId: string;

  @Column({ type: "text", default: "extracted" })
  origin: ObligationOrigin;

  @Column({ type: "text" })
  category: string;

  @Column({ type: "text" })
  key: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
