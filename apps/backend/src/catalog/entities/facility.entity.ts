import type { FacilityKind } from "@hackaton/contracts";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity({ name: "facility" })
@Unique("facility_titular_name_key", ["titular", "name"])
export class FacilityEntity {
  @PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "facility_pkey" })
  id: string;

  @Column({ type: "text" })
  titular: string;

  @Column({ type: "text" })
  kind: FacilityKind;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "text" })
  comuna: string;

  @Column({ name: "external_codes", type: "jsonb", default: () => "'{}'" })
  externalCodes: Record<string, string>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
