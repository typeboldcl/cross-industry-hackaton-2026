import type { DocumentDetail, ObligationListItem } from "@hackaton/contracts";
import type { INestApplication } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import type { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import type { CompletionRequest } from "../src/llm/llm-client.js";
import { createTestApp } from "./app.js";

const SAMPLE = resolve(
  import.meta.dirname,
  "../../../reference/RES SANITARIA SUSPEL 14_09_2023.pdf",
);

function quoteFrom(request: CompletionRequest): string {
  const prompt = request.messages.at(-1)?.content ?? "";
  const body = prompt.slice(prompt.indexOf("\n\n") + 2);
  const line =
    body.split("\n").find((candidate) => candidate.trim().length > 60) ?? body;
  return line.trim().slice(0, 80);
}

describe.skipIf(!existsSync(SAMPLE))("document flow", () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let facilityId: string;

  beforeAll(async () => {
    ({ app } = await createTestApp((req) => ({
      obligations: [
        {
          title: "Mantener la bodega de sustancias peligrosas autorizada",
          body: "Cumplir las condiciones de almacenamiento del D.S. 43/15.",
          category: "sustancias peligrosas",
          authorityCode: "SEREMI_SALUD",
          phase: "operacion",
          frequency: null,
          expectedEvidence: "registro de inspección de la bodega",
          dueDate: null,
          attributes: {},
          quote: quoteFrom(req),
        },
        {
          title: "Rotular los envases de sustancias peligrosas",
          body: "Mantener la rotulación según la NCh 2190.",
          category: "sustancias peligrosas",
          authorityCode: "SEREMI_SALUD",
          phase: "operacion",
          frequency: null,
          expectedEvidence: null,
          dueDate: null,
          attributes: {},
          quote: quoteFrom(req),
        },
      ],
    })));
    db = app.get(DataSource);
    await db.query(`DELETE FROM evidence`);
    await db.query(`DELETE FROM audit_item`);
    await db.query(`DELETE FROM audit`);
    await db.query(`DELETE FROM obligation_source`);
    await db.query(`DELETE FROM obligation_version`);
    await db.query(`DELETE FROM obligation`);
    await db.query(`DELETE FROM document`);
    [{ id: facilityId }] = await db.query(
      `SELECT id FROM facility WHERE name = 'Piscicultura Aucha'`,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  async function waitForProcessing(id: string): Promise<DocumentDetail> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const { body } = await request(app.getHttpServer()).get(
        `/api/documents/${id}`,
      );
      if (["done", "failed"].includes(body.processingStatus)) return body;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("processing did not finish");
  }

  it("uploads, deduplicates, extracts drafts and validates them", async () => {
    const pdf = readFileSync(SAMPLE);
    const upload = () =>
      request(app.getHttpServer())
        .post(`/api/facilities/${facilityId}/documents`)
        .field("kind", "res_sanitaria")
        .attach("file", pdf, "RES SANITARIA SUSPEL 14_09_2023.pdf");

    const created = await upload().expect(201);
    const duplicate = await upload().expect(200);
    expect(duplicate.body.id).toBe(created.body.id);
    expect(created.body.issuer.code).toBe("SEREMI_SALUD");

    const processed = await waitForProcessing(created.body.id);
    expect(processed.processingStatus).toBe("done");
    expect(processed.number).toBe("2310322819");
    expect(processed.extraction?.sectionsDone).toBe(
      processed.extraction?.sectionsTotal,
    );
    expect(processed.extraction?.draftsCreated).toBeGreaterThan(0);

    const { body: drafts } = await request(app.getHttpServer())
      .get(`/api/facilities/${facilityId}/obligations?status=draft`)
      .expect(200);
    const [first] = drafts as ObligationListItem[];
    expect(first?.authority.code).toBe("SEREMI_SALUD");
    expect(first?.version.sources[0]?.verified).toBe(true);
    expect(first?.version.expectedEvidence).toBe(
      "registro de inspección de la bodega",
    );

    await request(app.getHttpServer())
      .post(`/api/obligation-versions/${first?.version.id}/validate`)
      .expect(400);
    const validated = await request(app.getHttpServer())
      .post(`/api/obligation-versions/${first?.version.id}/validate`)
      .set("X-Actor-Name", "Responsable Aucha")
      .expect(200);
    expect(validated.body.status).toBe("validated");
    expect(validated.body.validatedBy).toBe("Responsable Aucha");

    await request(app.getHttpServer())
      .patch(`/api/obligation-versions/${first?.version.id}`)
      .send({ title: "No debería cambiar" })
      .expect(409);

    const second = (drafts as ObligationListItem[])[1];
    expect(second).toBeDefined();
    if (second) {
      const edited = await request(app.getHttpServer())
        .patch(`/api/obligation-versions/${second.version.id}`)
        .send({ title: "Título corregido" })
        .expect(200);
      expect(edited.body.edited).toBe(true);
      const rejected = await request(app.getHttpServer())
        .post(`/api/obligation-versions/${second.version.id}/reject`)
        .set("X-Actor-Name", "Responsable Aucha")
        .expect(200);
      expect(rejected.body.status).toBe("rejected");
      const restored = await request(app.getHttpServer())
        .post(`/api/obligation-versions/${second.version.id}/restore`)
        .set("X-Actor-Name", "Responsable Aucha")
        .expect(200);
      expect(restored.body.status).toBe("draft");
    }

    const reprocessed = await request(app.getHttpServer())
      .post(`/api/documents/${created.body.id}/extraction`)
      .expect(202);
    expect(reprocessed.body.documentId).toBe(created.body.id);
    await waitForProcessing(created.body.id);
    const [{ count }] = await db.query(
      `SELECT count(*)::int AS count FROM obligation_version WHERE obligation_id = $1`,
      [first?.obligationId],
    );
    expect(count).toBe(1);
  });

  it("rejects files that are not PDFs", async () => {
    await request(app.getHttpServer())
      .post(`/api/facilities/${facilityId}/documents`)
      .field("kind", "rca")
      .attach("file", Buffer.from("hola"), "nota.pdf")
      .expect(415);
  });
});
