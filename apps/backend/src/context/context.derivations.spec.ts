import type { SeiaPertinencia } from "@hackaton/contracts";
import {
  buildSummaryAlerts,
  deriveDocumentStatus,
  extractReferences,
  filterRelevantPertinencias,
  missingReferenceAlerts,
  pertinenciaUrl,
  toFacilityPertinencias,
  type DocumentFacts,
} from "./context.derivations.js";

function fact(overrides: Partial<DocumentFacts> = {}): DocumentFacts {
  return {
    id: "d1",
    kind: "rca",
    number: "202299101234",
    title: "RCA Aucha",
    processingStatus: "done",
    processingError: null,
    sectionsDone: 0,
    sectionsTotal: 0,
    ...overrides,
  };
}

function pertinencia(
  overrides: Partial<SeiaPertinencia> = {},
): SeiaPertinencia {
  return {
    id: "100",
    kind: "NEW",
    name: "Ampliación Piscicultura Aucha",
    proponent: "Invermar",
    comuna: null,
    state: null,
    submittedOn: null,
    ...overrides,
  };
}

describe("deriveDocumentStatus", () => {
  it("flags failed documents with the processing error", () => {
    expect(
      deriveDocumentStatus(
        fact({ processingStatus: "failed", processingError: "timeout" }),
        [],
      ),
    ).toEqual({
      status: "warn",
      statusNote: "Extracción incompleta: timeout",
    });
  });

  it.each(["queued", "processing"] as const)("reports %s progress", (state) => {
    expect(
      deriveDocumentStatus(
        fact({ processingStatus: state, sectionsDone: 2, sectionsTotal: 7 }),
        [],
      ),
    ).toEqual({ status: "info", statusNote: "Procesando 2 de 7 secciones" });
  });

  it("marks an RCA as rectified when a rectification exists", () => {
    const rca = fact();
    const rectification = fact({
      id: "d2",
      kind: "rectificacion",
      number: "RES-9",
    });
    expect(deriveDocumentStatus(rca, [rca, rectification])).toEqual({
      status: "info",
      statusNote: "Rectificada por RES-9",
    });
    expect(
      deriveDocumentStatus(rectification, [rca, rectification]).status,
    ).toBe("ok");
  });

  it("is ok otherwise", () => {
    expect(deriveDocumentStatus(fact(), [])).toEqual({
      status: "ok",
      statusNote: null,
    });
  });
});

describe("pertinencias", () => {
  it("builds the URL by kind", () => {
    expect(pertinenciaUrl(pertinencia({ id: "7", kind: "NEW" }))).toBe(
      "https://pertinencia.sea.gob.cl/api/public/expediente/7",
    );
    expect(pertinenciaUrl(pertinencia({ id: "7", kind: "OLD" }))).toBe(
      "https://seia.sea.gob.cl/pertinencia/verPertinencia.php?id_pertinencia=7",
    );
  });

  it("dedupes by id and keeps names with a distinctive word, ignoring case and accents", () => {
    const result = filterRelevantPertinencias(
      [
        pertinencia({ id: "1", name: "Mejoras en AUCHA" }),
        pertinencia({ id: "1", name: "Mejoras en AUCHA" }),
        pertinencia({ id: "2", name: "Piscicultura Otra" }),
        pertinencia({ id: "3", name: "Cambio Áucha norte" }),
      ],
      "Piscicultura Aucha",
    );
    expect(result.map((p) => p.id)).toEqual(["1", "3"]);
    expect(
      filterRelevantPertinencias(
        [pertinencia({ id: "4", name: "Planta Pucón" })],
        "Piscicultura Púcon",
      ),
    ).toHaveLength(1);
  });

  it("flags loaded pertinencias by matching document number", () => {
    const result = toFacilityPertinencias(
      [pertinencia({ id: "100" }), pertinencia({ id: "200" })],
      [
        { id: "doc", kind: "pertinencia", number: "100" },
        { id: "other", kind: "rca", number: "200" },
      ],
    );
    expect(result.map((p) => [p.loaded, p.documentId])).toEqual([
      [true, "doc"],
      [false, null],
    ]);
  });
});

describe("references", () => {
  it("extracts RCA and Resolución Exenta citations", () => {
    const refs = extractReferences([
      "Considerando la RCA N° 49 de fecha 06/02/2017 del proyecto.",
      "Véase Resolución Exenta N° 1.234/2020.",
    ]);
    expect(refs.map((r) => r.number)).toEqual(["49/2017", "1234/2020"]);
  });

  it("alerts only for citations that are neither loaded nor the document itself", () => {
    const alerts = missingReferenceAlerts(
      [
        {
          id: "d1",
          number: "10/2020",
          title: "Resolución RESPEL",
          pages: [
            "RCA N° 49 de fecha 06/02/2017",
            "RCA N° 49 de fecha 06/02/2017",
            "Resolución Exenta N° 10/2020",
            "Resolución Exenta N° 77/2019",
          ],
        },
      ],
      ["10/2020", "77/2019"],
    );
    expect(alerts).toEqual([
      expect.objectContaining({
        id: "missing-ref:49/2017",
        kind: "warn",
        title: "Documento citado no cargado",
        documentId: "d1",
      }),
    ]);
  });
});

describe("buildSummaryAlerts", () => {
  it("emits failed and info alerts only when relevant", () => {
    const { failed, info } = buildSummaryAlerts({
      unloadedPertinencias: 2,
      draftVersions: 0,
      failedDocuments: [{ id: "d1", title: "RCA", processingError: "boom" }],
    });
    expect(failed.map((a) => [a.id, a.kind])).toEqual([
      ["processing-failed:d1", "bad"],
    ]);
    expect(info.map((a) => a.id)).toEqual(["pertinencias-unloaded"]);
    expect(info[0]?.text).toContain("2");
  });
});
