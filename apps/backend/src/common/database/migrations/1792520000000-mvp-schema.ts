import type { MigrationInterface, QueryRunner } from "typeorm";

export class MvpSchema1792520000000 implements MigrationInterface {
  name = "MvpSchema1792520000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    // Installed database-wide by the RDS admin; IF NOT EXISTS makes this a no-op for an app role that cannot create extensions.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      CREATE TABLE facility (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        titular text NOT NULL,
        kind text NOT NULL,
        name text NOT NULL,
        comuna text NOT NULL,
        external_codes jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT facility_pkey PRIMARY KEY (id),
        CONSTRAINT facility_titular_name_key UNIQUE (titular, name),
        CONSTRAINT facility_kind_check CHECK (kind IN ('centro_cultivo', 'piscicultura', 'planta'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE authority (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        code text NOT NULL,
        name text NOT NULL,
        CONSTRAINT authority_pkey PRIMARY KEY (id),
        CONSTRAINT authority_code_key UNIQUE (code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE extraction_run (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        kind text NOT NULL,
        model text NOT NULL,
        prompt_version text NOT NULL,
        input_fingerprint text NOT NULL,
        input jsonb NOT NULL,
        output jsonb NOT NULL,
        tokens_in integer,
        tokens_out integer,
        cost_usd numeric(12, 6),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT extraction_run_pkey PRIMARY KEY (id),
        CONSTRAINT extraction_run_input_fingerprint_key UNIQUE (input_fingerprint),
        CONSTRAINT extraction_run_kind_check CHECK (kind IN ('detect_ids', 'extract', 'amend', 'answer'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE document (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        facility_id uuid NOT NULL,
        number text,
        sha256 text NOT NULL,
        storage_key text NOT NULL,
        mime text NOT NULL,
        kind text NOT NULL,
        issuer_id uuid,
        title text NOT NULL,
        issued_on date,
        origin text NOT NULL DEFAULT 'uploaded',
        source_url text,
        processing_status text NOT NULL DEFAULT 'uploaded',
        sections_total integer NOT NULL DEFAULT 0,
        sections_done integer NOT NULL DEFAULT 0,
        processing_error text,
        processed_at timestamptz,
        text_extracted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT document_pkey PRIMARY KEY (id),
        CONSTRAINT document_sha256_key UNIQUE (sha256),
        CONSTRAINT document_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES facility (id),
        CONSTRAINT document_issuer_id_fkey FOREIGN KEY (issuer_id) REFERENCES authority (id),
        CONSTRAINT document_sha256_check CHECK (sha256 ~ '^[0-9a-f]{64}$'),
        CONSTRAINT document_kind_check CHECK (kind IN ('rca', 'rectificacion', 'pertinencia', 'res_sanitaria', 'norma')),
        CONSTRAINT document_origin_check CHECK (origin IN ('uploaded', 'fetched')),
        CONSTRAINT document_processing_status_check CHECK (processing_status IN ('uploaded', 'queued', 'processing', 'done', 'failed')),
        CONSTRAINT document_sections_check CHECK (sections_done >= 0 AND sections_total >= 0 AND sections_done <= sections_total)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX document_facility_id_idx ON document (facility_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE document_chunk (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        document_id uuid NOT NULL,
        section_key text NOT NULL,
        part integer NOT NULL DEFAULT 1,
        text text NOT NULL,
        text_sha256 text NOT NULL,
        page_from integer NOT NULL,
        page_to integer NOT NULL,
        char_start integer NOT NULL,
        char_end integer NOT NULL,
        model text NOT NULL,
        embedding vector(1024) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT document_chunk_pkey PRIMARY KEY (id),
        CONSTRAINT document_chunk_document_id_fkey FOREIGN KEY (document_id) REFERENCES document (id) ON DELETE CASCADE,
        CONSTRAINT document_chunk_section_part_model_key UNIQUE (document_id, section_key, part, model),
        CONSTRAINT document_chunk_range_check CHECK (page_from <= page_to AND char_start <= char_end)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX document_chunk_embedding_idx ON document_chunk USING hnsw (embedding vector_cosine_ops)`,
    );

    await queryRunner.query(`
      CREATE TABLE obligation (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        facility_id uuid NOT NULL,
        authority_id uuid NOT NULL,
        category text NOT NULL,
        key text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT obligation_pkey PRIMARY KEY (id),
        CONSTRAINT obligation_facility_id_key_key UNIQUE (facility_id, key),
        CONSTRAINT obligation_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES facility (id),
        CONSTRAINT obligation_authority_id_fkey FOREIGN KEY (authority_id) REFERENCES authority (id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE obligation_version (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        obligation_id uuid NOT NULL,
        seq integer NOT NULL,
        title text NOT NULL,
        body text NOT NULL,
        phase text,
        frequency text,
        expected_evidence text,
        due_date date,
        due_rule jsonb,
        attributes jsonb NOT NULL DEFAULT '{}',
        status text NOT NULL DEFAULT 'draft',
        validated_by text,
        validated_at timestamptz,
        valid_from timestamptz,
        valid_to timestamptz,
        supersedes_id uuid,
        caused_by_document_id uuid,
        extraction_run_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT obligation_version_pkey PRIMARY KEY (id),
        CONSTRAINT obligation_version_obligation_id_seq_key UNIQUE (obligation_id, seq),
        CONSTRAINT obligation_version_extraction_run_id_obligation_id_key UNIQUE (extraction_run_id, obligation_id),
        CONSTRAINT obligation_version_obligation_id_fkey FOREIGN KEY (obligation_id) REFERENCES obligation (id) ON DELETE CASCADE,
        CONSTRAINT obligation_version_supersedes_id_fkey FOREIGN KEY (supersedes_id) REFERENCES obligation_version (id),
        CONSTRAINT obligation_version_caused_by_document_id_fkey FOREIGN KEY (caused_by_document_id) REFERENCES document (id),
        CONSTRAINT obligation_version_extraction_run_id_fkey FOREIGN KEY (extraction_run_id) REFERENCES extraction_run (id),
        CONSTRAINT obligation_version_phase_check CHECK (phase IN ('construccion', 'operacion', 'cierre')),
        CONSTRAINT obligation_version_status_check CHECK (status IN ('draft', 'validated', 'superseded', 'revoked')),
        CONSTRAINT obligation_version_validated_stamp_check CHECK (status NOT IN ('validated', 'superseded') OR (validated_at IS NOT NULL AND valid_from IS NOT NULL)),
        CONSTRAINT obligation_version_validity_check CHECK (valid_to IS NULL OR valid_from <= valid_to)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX obligation_version_one_validated_idx ON obligation_version (obligation_id) WHERE status = 'validated'`,
    );

    await queryRunner.query(`
      CREATE TABLE obligation_source (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        obligation_version_id uuid NOT NULL,
        document_id uuid NOT NULL,
        section_key text NOT NULL,
        page integer,
        char_start integer,
        char_end integer,
        quote text NOT NULL,
        CONSTRAINT obligation_source_pkey PRIMARY KEY (id),
        CONSTRAINT obligation_source_obligation_version_id_fkey FOREIGN KEY (obligation_version_id) REFERENCES obligation_version (id) ON DELETE CASCADE,
        CONSTRAINT obligation_source_document_id_fkey FOREIGN KEY (document_id) REFERENCES document (id),
        CONSTRAINT obligation_source_offsets_check CHECK ((page IS NULL AND char_start IS NULL AND char_end IS NULL) OR (page IS NOT NULL AND char_start IS NOT NULL AND char_end IS NOT NULL AND char_start <= char_end))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX obligation_source_document_id_section_key_idx ON obligation_source (document_id, section_key)`,
    );
    await queryRunner.query(
      `CREATE INDEX obligation_source_obligation_version_id_idx ON obligation_source (obligation_version_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE audit (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        facility_id uuid NOT NULL,
        authority_id uuid NOT NULL,
        kind text NOT NULL,
        period_from date,
        period_to date,
        status text NOT NULL DEFAULT 'planned',
        planned_on date,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT audit_pkey PRIMARY KEY (id),
        CONSTRAINT audit_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES facility (id),
        CONSTRAINT audit_authority_id_fkey FOREIGN KEY (authority_id) REFERENCES authority (id),
        CONSTRAINT audit_status_check CHECK (status IN ('planned', 'in_progress', 'closed')),
        CONSTRAINT audit_period_check CHECK (period_from IS NULL OR period_to IS NULL OR period_from <= period_to)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX audit_facility_id_idx ON audit (facility_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE audit_item (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        audit_id uuid NOT NULL,
        obligation_version_id uuid NOT NULL,
        result text NOT NULL DEFAULT 'pending',
        notes text,
        assessed_by_name text,
        assessed_at timestamptz,
        CONSTRAINT audit_item_pkey PRIMARY KEY (id),
        CONSTRAINT audit_item_audit_id_obligation_version_id_key UNIQUE (audit_id, obligation_version_id),
        CONSTRAINT audit_item_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES audit (id) ON DELETE CASCADE,
        CONSTRAINT audit_item_obligation_version_id_fkey FOREIGN KEY (obligation_version_id) REFERENCES obligation_version (id),
        CONSTRAINT audit_item_result_check CHECK (result IN ('compliant', 'non_compliant', 'not_applicable', 'pending'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE evidence (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        facility_id uuid NOT NULL,
        obligation_id uuid NOT NULL,
        audit_item_id uuid,
        sha256 text NOT NULL,
        storage_key text NOT NULL,
        mime text NOT NULL,
        captured_at timestamptz,
        client_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT evidence_pkey PRIMARY KEY (id),
        CONSTRAINT evidence_client_id_key UNIQUE (client_id),
        CONSTRAINT evidence_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES facility (id),
        CONSTRAINT evidence_obligation_id_fkey FOREIGN KEY (obligation_id) REFERENCES obligation (id),
        CONSTRAINT evidence_audit_item_id_fkey FOREIGN KEY (audit_item_id) REFERENCES audit_item (id) ON DELETE SET NULL,
        CONSTRAINT evidence_sha256_check CHECK (sha256 ~ '^[0-9a-f]{64}$')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX evidence_audit_item_id_idx ON evidence (audit_item_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      "evidence",
      "audit_item",
      "audit",
      "obligation_source",
      "obligation_version",
      "obligation",
      "document_chunk",
      "document",
      "extraction_run",
      "authority",
      "facility",
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
