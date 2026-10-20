import type { MigrationInterface, QueryRunner } from "typeorm";

export class MvpReview1792520300000 implements MigrationInterface {
  name = "MvpReview1792520300000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE obligation_version
        ADD COLUMN edited boolean NOT NULL DEFAULT false,
        ADD COLUMN amendment_note text,
        DROP CONSTRAINT obligation_version_status_check,
        ADD CONSTRAINT obligation_version_status_check CHECK (status IN ('draft', 'validated', 'superseded', 'revoked', 'rejected'))
    `);
    await queryRunner.query(
      `UPDATE audit SET kind = CASE WHEN lower(kind) LIKE '%interna%' THEN 'interna' WHEN lower(kind) LIKE '%seguimiento%' THEN 'seguimiento' WHEN lower(kind) LIKE '%simulacro%' THEN 'simulacro_sma' WHEN lower(kind) LIKE '%extern%' THEN 'externa' ELSE 'interna' END
       WHERE kind NOT IN ('interna', 'seguimiento', 'externa', 'simulacro_sma')`,
    );
    await queryRunner.query(`
      ALTER TABLE audit
        ADD CONSTRAINT audit_kind_check CHECK (kind IN ('interna', 'seguimiento', 'externa', 'simulacro_sma'))
    `);
    await queryRunner.query(
      `UPDATE audit_item SET na_reason = 'other' WHERE na_reason IS NOT NULL AND na_reason NOT IN ('activity_not_performed', 'not_current_phase', 'outside_period', 'other')`,
    );
    await queryRunner.query(`
      ALTER TABLE audit_item
        ADD CONSTRAINT audit_item_na_reason_value_check CHECK (na_reason IN ('activity_not_performed', 'not_current_phase', 'outside_period', 'other')),
        ADD CONSTRAINT audit_item_other_reason_note_check CHECK (na_reason IS DISTINCT FROM 'other' OR coalesce(btrim(notes), '') <> '')
    `);
    await queryRunner.query(
      `ALTER TABLE evidence ADD COLUMN uploaded_by_name text`,
    );
    await queryRunner.query(`ALTER TABLE facility ADD COLUMN location text`);
    await queryRunner.query(
      `UPDATE facility SET location = 'Sector Aucha, Calbuco, Región de Los Lagos' WHERE name = 'Piscicultura Aucha' AND location IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE facility DROP COLUMN location`);
    await queryRunner.query(
      `ALTER TABLE evidence DROP COLUMN uploaded_by_name`,
    );
    await queryRunner.query(`
      ALTER TABLE audit_item
        DROP CONSTRAINT audit_item_other_reason_note_check,
        DROP CONSTRAINT audit_item_na_reason_value_check
    `);
    await queryRunner.query(
      `ALTER TABLE audit DROP CONSTRAINT audit_kind_check`,
    );
    await queryRunner.query(
      `UPDATE obligation_version SET status = 'revoked' WHERE status = 'rejected'`,
    );
    await queryRunner.query(`
      ALTER TABLE obligation_version
        DROP CONSTRAINT obligation_version_status_check,
        ADD CONSTRAINT obligation_version_status_check CHECK (status IN ('draft', 'validated', 'superseded', 'revoked')),
        DROP COLUMN amendment_note,
        DROP COLUMN edited
    `);
  }
}
