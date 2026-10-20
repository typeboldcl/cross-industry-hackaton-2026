import type { AuditDetail } from "@hackaton/contracts";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import { createTestApp } from "./app.js";

describe("audit flow", () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let facilityId: string;
  let smaId: string;
  let seremiId: string;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    db = app.get(DataSource);
    [{ id: facilityId }] = await db.query(
      `SELECT id FROM facility WHERE name = 'Piscicultura Aucha'`,
    );
    [{ id: smaId }] = await db.query(
      `SELECT id FROM authority WHERE code = 'SMA'`,
    );
    [{ id: seremiId }] = await db.query(
      `SELECT id FROM authority WHERE code = 'SEREMI_SALUD'`,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  async function validatedObligation(authorityId: string, title: string) {
    const [{ id: obligationId }] = await db.query(
      `INSERT INTO obligation (facility_id, authority_id, category, key)
       VALUES ($1, $2, 'monitoreo', $3) RETURNING id`,
      [facilityId, authorityId, `audit-test-${randomUUID()}`],
    );
    const [{ id: versionId }] = await db.query(
      `INSERT INTO obligation_version (obligation_id, seq, title, body, status, validated_by, validated_at, valid_from)
       VALUES ($1, 1, $2, 'Detalle', 'validated', 'Responsable', now(), now()) RETURNING id`,
      [obligationId, title],
    );
    return { obligationId, versionId };
  }

  it("pre-fills by authority, assesses, stores evidence once and locks when closed", async () => {
    const sma = await validatedObligation(smaId, "Medir efluentes");
    await validatedObligation(seremiId, "Rotular residuos peligrosos");

    const { body: audit } = (await request(app.getHttpServer())
      .post("/api/audits")
      .send({
        facilityId,
        authorityId: smaId,
        kind: "auditoría interna",
        periodFrom: "2026-07-01",
        periodTo: "2026-09-30",
        plannedOn: "2026-10-21",
      })
      .expect(201)) as { body: AuditDetail };

    expect(audit.status).toBe("planned");
    expect(audit.items.map((item) => item.version.title)).toContain(
      "Medir efluentes",
    );
    expect(audit.items.map((item) => item.version.title)).not.toContain(
      "Rotular residuos peligrosos",
    );
    const item = audit.items.find((i) => i.obligationId === sma.obligationId)!;

    const assessed = await request(app.getHttpServer())
      .patch(`/api/audit-items/${item.id}`)
      .set("X-Actor-Name", "Auditora")
      .send({ result: "non_compliant", notes: "Falta el informe de agosto" })
      .expect(200);
    expect(assessed.body.assessedByName).toBe("Auditora");

    const clientId = randomUUID();
    const upload = () =>
      request(app.getHttpServer())
        .post(`/api/audit-items/${item.id}/evidence`)
        .field("clientId", clientId)
        .attach("file", Buffer.from("foto"), {
          filename: "foto.jpg",
          contentType: "image/jpeg",
        });
    const first = await upload().expect(201);
    const replay = await upload().expect(200);
    expect(replay.body.id).toBe(first.body.id);

    const { body: compliance } = await request(app.getHttpServer())
      .get(`/api/facilities/${facilityId}/compliance`)
      .expect(200);
    const entry = compliance.obligations.find(
      (o: { obligationId: string }) => o.obligationId === sma.obligationId,
    );
    expect(entry.state).toBe("non_compliant");

    const { body: detail } = await request(app.getHttpServer())
      .get(`/api/audits/${audit.id}`)
      .expect(200);
    expect(detail.status).toBe("in_progress");
    expect(
      detail.items.find((i: { id: string }) => i.id === item.id).evidence,
    ).toHaveLength(1);

    await request(app.getHttpServer())
      .post(`/api/audits/${audit.id}/close`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/audit-items/${item.id}`)
      .set("X-Actor-Name", "Auditora")
      .send({ result: "compliant" })
      .expect(409);
  });
});
