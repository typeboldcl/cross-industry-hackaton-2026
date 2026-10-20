import type { DocumentDetail, ObligationListItem } from "@hackaton/contracts";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import type { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import { AppModule } from "../src/app.module.js";
import { ENV, type Env } from "../src/common/config/env.js";
import { configureApp } from "../src/configure-app.js";

const SAMPLE = resolve(
  import.meta.dirname,
  "../../../reference/RES SANITARIA BODEGA RESPEL AUCHA 23.01.2024.pdf",
);

describe.skipIf(!process.env.LIVE_LLM || !existsSync(SAMPLE))(
  "live extraction against Orbit and OBS",
  () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      const moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleFixture.createNestApplication();
      configureApp(app, app.get<Env>(ENV));
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it("extracts verified drafts from a sanitary resolution", async () => {
      const db = app.get(DataSource);
      const [{ id: facilityId }] = await db.query(
        `SELECT id FROM facility WHERE name = 'Piscicultura Aucha'`,
      );

      const upload = await request(app.getHttpServer())
        .post(`/api/facilities/${facilityId}/documents`)
        .field("kind", "res_sanitaria")
        .attach(
          "file",
          readFileSync(SAMPLE),
          "RES SANITARIA BODEGA RESPEL AUCHA 23.01.2024.pdf",
        );
      expect([200, 201]).toContain(upload.status);

      let document: DocumentDetail = upload.body;
      for (
        let i = 0;
        i < 120 && !["done", "failed"].includes(document.processingStatus);
        i += 1
      ) {
        await new Promise((r) => setTimeout(r, 2_000));
        document = (
          await request(app.getHttpServer()).get(
            `/api/documents/${document.id}`,
          )
        ).body;
      }

      const { body: drafts } = await request(app.getHttpServer()).get(
        `/api/facilities/${facilityId}/obligations?documentId=${document.id}`,
      );
      const summary = (drafts as ObligationListItem[]).map((d) => ({
        title: d.version.title,
        authority: d.authority.code,
        category: d.category,
        frequency: d.version.frequency,
        evidence: d.version.expectedEvidence,
        verified: d.version.sources[0]?.verified,
        page: d.version.sources[0]?.page,
      }));
      console.log(
        JSON.stringify(
          {
            status: document.processingStatus,
            error: document.extraction?.error,
            sections: document.extraction?.sectionsTotal,
            drafts: summary,
          },
          null,
          2,
        ),
      );

      expect(document.processingStatus).toBe("done");
      expect(summary.length).toBeGreaterThan(0);
    }, 300_000);
  },
);
