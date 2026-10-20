import type { FacilityContext } from "@hackaton/contracts";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import { AppModule } from "../src/app.module.js";
import { ENV, type Env } from "../src/common/config/env.js";
import { configureApp } from "../src/configure-app.js";
import { ContextModule } from "../src/context/context.module.js";
import { FakeLlm } from "../src/llm/fake-llm.js";
import { LLM_CLIENT } from "../src/llm/llm-client.js";
import { SeiaClient } from "../src/seia/seia.client.js";
import { MemoryStorage } from "../src/storage/memory-storage.js";
import { STORAGE } from "../src/storage/storage.service.js";

describe("facility context", () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let storage: MemoryStorage;
  let facilityId: string;
  const searchPertinencias = vi.fn();

  beforeAll(async () => {
    storage = new MemoryStorage();
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule, ContextModule],
    })
      .overrideProvider(STORAGE)
      .useValue(storage)
      .overrideProvider(LLM_CLIENT)
      .useValue(new FakeLlm(() => ({ obligations: [] })))
      .overrideProvider(SeiaClient)
      .useValue({ searchPertinencias })
      .compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>();
    configureApp(app, app.get<Env>(ENV));
    await app.init();
    db = app.get(DataSource);
    [{ id: facilityId }] = await db.query(
      `INSERT INTO facility (titular, kind, name, comuna) VALUES ('Invermar Ctx', 'piscicultura', 'Piscicultura Aucha Ctx', 'Panguipulli') RETURNING id`,
    );
  });

  afterAll(async () => {
    await db.query(`DELETE FROM document WHERE facility_id = $1`, [facilityId]);
    await db.query(`DELETE FROM facility WHERE id = $1`, [facilityId]);
    await app.close();
  });

  async function insertDocument(values: {
    kind: string;
    number: string | null;
    title: string;
    status?: string;
    error?: string;
    pages?: string[];
  }): Promise<string> {
    const sha256 = randomUUID().replaceAll("-", "").padEnd(64, "0");
    const [{ id }] = await db.query(
      `INSERT INTO document (facility_id, number, sha256, storage_key, mime, kind, title, processing_status, processing_error, sections_total, sections_done)
       VALUES ($1, $2, $3, $4, 'application/pdf', $5, $6, $7, $8, 5, 2) RETURNING id`,
      [
        facilityId,
        values.number,
        sha256,
        `documents/${sha256}.pdf`,
        values.kind,
        values.title,
        values.status ?? "done",
        values.error ?? null,
      ],
    );
    if (values.pages) {
      await storage.put(
        `text/${sha256}.pages.json`,
        Buffer.from(JSON.stringify({ pages: values.pages })),
        "application/json",
      );
    }
    return id;
  }

  it("returns documents, pertinencias, alerts and audits in one call", async () => {
    await db.query(`DELETE FROM document WHERE facility_id = $1`, [facilityId]);
    const respel = await insertDocument({
      kind: "res_sanitaria",
      number: "5555/2019",
      title: "Resolución RESPEL",
      pages: ["Conforme a la RCA N° 49 de fecha 06/02/2017 se autoriza."],
    });
    const failed = await insertDocument({
      kind: "norma",
      number: null,
      title: "Norma rota",
      status: "failed",
      error: "PDF ilegible",
    });
    const processing = await insertDocument({
      kind: "otro",
      number: null,
      title: "En curso",
      status: "processing",
    });
    const loadedPertinencia = await insertDocument({
      kind: "pertinencia",
      number: "900",
      title: "Pertinencia cargada",
    });

    searchPertinencias.mockImplementation(async (name: string) => ({
      total: 3,
      items: [
        {
          id: "900",
          kind: "NEW",
          name: "Pertinencia Aucha 1",
          proponent: "Invermar",
          comuna: null,
          state: null,
          submittedOn: null,
        },
        {
          id: "901",
          kind: "OLD",
          name: "Pertinencia AUCHA 2",
          proponent: "Invermar",
          comuna: null,
          state: null,
          submittedOn: null,
        },
        {
          id: "902",
          kind: "OLD",
          name: "Otro centro",
          proponent: "Invermar",
          comuna: null,
          state: null,
          submittedOn: null,
        },
      ].slice(0, name ? 3 : 2),
    }));

    const { body } = (await request(app.getHttpServer())
      .get(`/api/facilities/${facilityId}/context`)
      .expect(200)) as { body: FacilityContext };

    expect(body.facility.id).toBe(facilityId);
    expect(body.pertinenciasError).toBeNull();
    expect(Array.isArray(body.audits)).toBe(true);

    const byId = new Map(body.documents.map((d) => [d.id, d]));
    expect(byId.get(respel)).toMatchObject({ status: "ok", statusNote: null });
    expect(byId.get(failed)).toMatchObject({
      status: "warn",
      processingStatus: "failed",
      statusNote: "Extracción incompleta: PDF ilegible",
    });
    expect(byId.get(processing)).toMatchObject({
      status: "info",
      statusNote: "Procesando 2 de 5 secciones",
    });

    expect(
      body.pertinencias.map((p) => [p.id, p.loaded, p.documentId]),
    ).toEqual([
      ["900", true, loadedPertinencia],
      ["901", false, null],
    ]);
    expect(body.pertinencias[0]?.url).toBe(
      "https://pertinencia.sea.gob.cl/api/public/expediente/900",
    );
    expect(body.pertinencias[1]?.url).toBe(
      "https://seia.sea.gob.cl/pertinencia/verPertinencia.php?id_pertinencia=901",
    );

    const alertIds = body.alerts.map((a) => a.id);
    expect(alertIds).toContain(`processing-failed:${failed}`);
    expect(alertIds).toContain("missing-ref:49/2017");
    expect(alertIds).toContain("pertinencias-unloaded");
    expect(
      body.alerts.find((a) => a.id === "missing-ref:49/2017"),
    ).toMatchObject({ kind: "warn", documentId: respel });
  });

  it("reports the SEIA failure without failing the call", async () => {
    const other = randomUUID();
    await db.query(
      `INSERT INTO facility (id, titular, kind, name, comuna) VALUES ($1, 'Titular X', 'planta', 'Planta Cache', 'Puerto Montt')`,
      [other],
    );
    searchPertinencias.mockRejectedValue(new Error("SEIA caído"));

    const { body } = (await request(app.getHttpServer())
      .get(`/api/facilities/${other}/context`)
      .expect(200)) as { body: FacilityContext };

    expect(body.pertinencias).toEqual([]);
    expect(body.pertinenciasError).toBe("SEIA caído");
    await db.query(`DELETE FROM facility WHERE id = $1`, [other]);
  });

  it("returns 404 for an unknown facility", async () => {
    await request(app.getHttpServer())
      .get(`/api/facilities/${randomUUID()}/context`)
      .expect(404);
  });
});
