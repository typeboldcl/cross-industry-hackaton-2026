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

    const { body: created } = (await request(app.getHttpServer())
      .post("/api/audits")
      .set("X-Actor-Name", "Jefa de centro")
      .send({
        facilityId,
        title: "Auditoría interna Q4 2026",
        kind: "interna",
        plannedOn: "2026-10-21",
        authorityId: smaId,
      })
      .expect(201)) as { body: AuditDetail };
    expect(created.status).toBe("draft");
    expect(created.items).toHaveLength(0);

    await request(app.getHttpServer())
      .post(`/api/audits/${created.id}/generate`)
      .expect(200);
    const { body: audit } = (await request(app.getHttpServer())
      .post(`/api/audits/${created.id}/publish`)
      .set("X-Actor-Name", "Responsable cumplimiento")
      .send({ excludedCategories: [] })
      .expect(200)) as { body: AuditDetail };

    expect(audit.status).toBe("published");
    expect(audit.validatedByName).toBe("Responsable cumplimiento");
    const item = audit.items.find((i) => i.obligationId === sma.obligationId)!;

    await request(app.getHttpServer())
      .patch(`/api/audit-items/${item.id}`)
      .set("X-Actor-Name", "Auditora")
      .send({ result: "non_compliant" })
      .expect(400);
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
    expect(first.body.filename).toBe("foto.jpg");
    expect(first.body.thumbUrl).toBe(`/api/evidence/${first.body.id}/file`);

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
    expect(detail.status).toBe("published");
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
