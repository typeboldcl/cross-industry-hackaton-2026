import type { MigrationInterface, QueryRunner } from "typeorm";

export class FrontendAlignment1792520200000 implements MigrationInterface {
  name = "FrontendAlignment1792520200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE audit
        ADD COLUMN title text NOT NULL DEFAULT '',
        ADD COLUMN created_by_name text,
        ADD COLUMN validated_by_name text,
        ADD COLUMN published_at timestamptz,
        ADD COLUMN closed_at timestamptz,
        ADD COLUMN excluded_categories text[] NOT NULL DEFAULT '{}',
        ADD COLUMN client_id uuid,
        ALTER COLUMN authority_id DROP NOT NULL,
        DROP CONSTRAINT audit_status_check
    `);
    await queryRunner.query(
      `UPDATE audit SET status = CASE status WHEN 'planned' THEN 'draft' WHEN 'in_progress' THEN 'published' ELSE status END`,
    );
    await queryRunner.query(`
      ALTER TABLE audit
        ALTER COLUMN status SET DEFAULT 'draft',
        ADD CONSTRAINT audit_status_check CHECK (status IN ('draft', 'in_validation', 'published', 'closed')),
        ADD CONSTRAINT audit_client_id_key UNIQUE (client_id)
    `);

    await queryRunner.query(`
      ALTER TABLE audit_item
        ADD COLUMN position integer NOT NULL DEFAULT 0,
        ADD COLUMN na_reason text,
        ADD CONSTRAINT audit_item_non_compliant_note_check CHECK (result <> 'non_compliant' OR coalesce(btrim(notes), '') <> ''),
        ADD CONSTRAINT audit_item_na_reason_check CHECK (result <> 'not_applicable' OR coalesce(btrim(na_reason), '') <> '')
    `);

    await queryRunner.query(`ALTER TABLE evidence ADD COLUMN filename text`);

    await queryRunner.query(`
      ALTER TABLE obligation
        ADD COLUMN origin text NOT NULL DEFAULT 'extracted',
        ADD CONSTRAINT obligation_origin_check CHECK (origin IN ('extracted', 'manual'))
    `);

    await queryRunner.query(`
      ALTER TABLE document
        DROP CONSTRAINT document_kind_check,
        ADD CONSTRAINT document_kind_check CHECK (kind IN ('rca', 'rectificacion', 'pertinencia', 'res_sanitaria', 'norma', 'otro'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE document
        DROP CONSTRAINT document_kind_check,
        ADD CONSTRAINT document_kind_check CHECK (kind IN ('rca', 'rectificacion', 'pertinencia', 'res_sanitaria', 'norma'))
    `);
    await queryRunner.query(
      `ALTER TABLE obligation DROP CONSTRAINT obligation_origin_check, DROP COLUMN origin`,
    );
    await queryRunner.query(`ALTER TABLE evidence DROP COLUMN filename`);
    await queryRunner.query(`
      ALTER TABLE audit_item
        DROP CONSTRAINT audit_item_na_reason_check,
        DROP CONSTRAINT audit_item_non_compliant_note_check,
        DROP COLUMN na_reason,
        DROP COLUMN position
    `);
    await queryRunner.query(
      `ALTER TABLE audit DROP CONSTRAINT audit_client_id_key, DROP CONSTRAINT audit_status_check`,
    );
    await queryRunner.query(
      `UPDATE audit SET status = CASE status WHEN 'draft' THEN 'planned' WHEN 'in_validation' THEN 'planned' WHEN 'published' THEN 'in_progress' ELSE status END`,
    );
    await queryRunner.query(`
      ALTER TABLE audit
        ALTER COLUMN status SET DEFAULT 'planned',
        ADD CONSTRAINT audit_status_check CHECK (status IN ('planned', 'in_progress', 'closed')),
        DROP COLUMN client_id,
        DROP COLUMN excluded_categories,
        DROP COLUMN closed_at,
        DROP COLUMN published_at,
        DROP COLUMN validated_by_name,
        DROP COLUMN created_by_name,
        DROP COLUMN title
    `);
  }
}
