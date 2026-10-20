import type { INestApplication } from "@nestjs/common";
import type { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import { createTestApp } from "./app.js";

describe("MVP schema", () => {
  let app: INestApplication<App>;
  let db: DataSource;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    db = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createObligation(): Promise<string> {
    const [{ id }] = await db.query(
      `INSERT INTO obligation (facility_id, authority_id, category, key)
       SELECT f.id, a.id, 'monitoreo', 'test-' || gen_random_uuid()
       FROM facility f, authority a
       WHERE f.name = 'Piscicultura Aucha' AND a.code = 'SMA'
       RETURNING id`,
    );
    return id;
  }

  async function insertVersion(
    obligationId: string,
    seq: number,
    status: string,
  ): Promise<void> {
    await db.query(
      `INSERT INTO obligation_version (obligation_id, seq, title, body, status, validated_at, valid_from)
       VALUES ($1, $2, 'Medir nivel freático', 'Diario en Pi1', $3, now(), now())`,
      [obligationId, seq, status],
    );
  }

  it("seeds the authorities and the Aucha facility", async () => {
    const [{ count }] = await db.query(
      `SELECT count(*)::int AS count FROM authority`,
    );
    const facilities = await db.query(
      `SELECT name FROM facility WHERE titular = 'Invermar S.A.'`,
    );

    expect(count).toBe(9);
    expect(facilities).toEqual([{ name: "Piscicultura Aucha" }]);
  });

  it("allows only one validated version per obligation", async () => {
    const obligationId = await createObligation();
    await insertVersion(obligationId, 1, "validated");

    await expect(insertVersion(obligationId, 2, "validated")).rejects.toThrow(
      /obligation_version_one_validated_idx/,
    );
    await expect(
      insertVersion(obligationId, 2, "draft"),
    ).resolves.toBeUndefined();
  });

  it("stores 1024-dimension embeddings", async () => {
    const [{ type }] = await db.query(
      `SELECT format_type(atttypid, atttypmod) AS type
       FROM pg_attribute
       WHERE attrelid = 'document_chunk'::regclass AND attname = 'embedding'`,
    );

    expect(type).toBe("vector(1024)");
  });
});
