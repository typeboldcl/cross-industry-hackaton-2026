import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "authority" })
@Unique("authority_code_key", ["code"])
export class AuthorityEntity {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "authority_pkey",
  })
  id: string;

  @Column({ type: "text" })
  code: string;

  @Column({ type: "text" })
  name: string;
}
