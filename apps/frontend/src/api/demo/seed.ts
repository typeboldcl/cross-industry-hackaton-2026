import type {
  AuditResult,
  DocumentKind,
  FacilityKind,
  NaReason,
  ObligationVersion,
} from "@hackaton/contracts";
import {
  ALERTAS,
  DOCS_AUCHA,
  INSTALACIONES,
  PERT_AUCHA,
  REQ_TEMPLATES,
  type RequisitoExtraido,
} from "../../data/seed";
import type { DemoAudit, DemoDb, DemoItem, DemoObligation } from "./db";

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** Las mismas instituciones que siembra la migración del backend. */
const AUTHORITIES: [string, string][] = [
  ["SEA", "Servicio de Evaluación Ambiental"],
  ["SMA", "Superintendencia del Medio Ambiente"],
  ["SERNAPESCA", "Servicio Nacional de Pesca y Acuicultura"],
  ["SUBPESCA", "Subsecretaría de Pesca y Acuicultura"],
  ["SEREMI_SALUD", "Secretaría Regional Ministerial de Salud"],
  ["DGA", "Dirección General de Aguas"],
  ["SAG", "Servicio Agrícola y Ganadero"],
  ["CMN", "Consejo de Monumentos Nacionales"],
  [
    "DIRECTEMAR",
    "Dirección General del Territorio Marítimo y de Marina Mercante",
  ],
];

const FACILITY_KIND: Record<string, FacilityKind> = {
  aucha: "piscicultura",
  ces: "centro_cultivo",
  planta: "planta",
};

const DOC_KIND: Record<string, DocumentKind> = {
  RCA: "rca",
  Rectificación: "rectificacion",
  "Res. sanitaria": "res_sanitaria",
};

/** Las resoluciones sanitarias (D3, D4) las fiscaliza la SEREMI; el resto, la SMA. */
const authorityCodeFor = (docKey: string) =>
  docKey === "D3" || docKey === "D4" ? "SEREMI_SALUD" : "SMA";

/** Estado inicial: centros, documentos y alertas, sin requisitos ni auditorías. */
export function emptyDb(): DemoDb {
  const authorities = AUTHORITIES.map(([code, name]) => ({
    id: uuid(),
    code,
    name,
  }));
  const byCode = (code: string) => authorities.find((a) => a.code === code)!;
  const created = now();

  const facilities = INSTALACIONES.map((i) => ({
    id: uuid(),
    titular: "Invermar S.A.",
    kind: FACILITY_KIND[i.id] ?? "piscicultura",
    name: i.nombre,
    comuna: i.id === "aucha" ? "Calbuco" : "Datos ficticios",
    location: i.lugar,
    externalCodes: { demo: i.id },
    createdAt: created,
  }));
  const aucha = facilities[0];

  const documents = DOCS_AUCHA.map((d) => ({
    id: uuid(),
    facilityId: aucha.id,
    kind: DOC_KIND[d.tipo] ?? "otro",
    number: d.numero,
    title: d.titulo,
    issuedOn: d.fecha ?? null,
    issuer: byCode(d.tipo === "Res. sanitaria" ? "SEREMI_SALUD" : "SEA"),
    origin: "uploaded" as const,
    textExtractedAt: created,
    createdAt: created,
    processingStatus: "done" as const,
    status: d.estado ?? "info",
    statusNote: d.vigencia ?? null,
    // Clave del documento en los datos de ejemplo (D1…D4), para ligar requisitos.
    demoKey: d.id,
  }));

  const pertinencias = PERT_AUCHA.map((p) => ({
    facilityId: aucha.id,
    id: uuid(),
    kind: "NEW" as const,
    name: `${p.titulo} · ${p.numero}`,
    proponent: "Invermar S.A.",
    comuna: "Calbuco",
    state: "Resuelta",
    submittedOn: null,
    loaded: false,
    documentId: null,
    url: `https://seia.sea.gob.cl/pertinencia/${encodeURIComponent(p.numero)}`,
  }));

  const alerts = ALERTAS.map((a) => ({
    facilityId: aucha.id,
    id: uuid(),
    kind: a.tipo,
    title: a.titulo,
    text: a.texto,
    documentId: null,
  }));

  return {
    authorities,
    facilities,
    documents,
    pertinencias,
    alerts,
    obligations: [],
    versions: [],
    audits: [],
    items: [],
    evidence: [],
  };
}

/**
 * Lo que haría la extracción con LLM al procesar los documentos de Aucha:
 * un requisito propuesto por cada obligación de `REQ_TEMPLATES`.
 */
export function extractAuchaDrafts(db: DemoDb, facilityId: string): void {
  REQ_TEMPLATES.forEach((t) => addObligation(db, facilityId, t, "draft", null));
}

function addObligation(
  db: DemoDb,
  facilityId: string,
  t: RequisitoExtraido,
  status: ObligationVersion["status"],
  validatedBy: string | null,
  at = now(),
): ObligationVersion {
  const authority = db.authorities.find(
    (a) => a.code === authorityCodeFor(t.fuente.doc),
  )!;
  const doc = db.documents.find(
    (d) => (d as { demoKey?: string }).demoKey === t.fuente.doc,
  );
  const obligation: DemoObligation = {
    id: uuid(),
    facilityId,
    authorityId: authority.id,
    key: t.id.toLowerCase(),
    origin: "extracted",
    category: t.tema,
    createdAt: at,
  };
  const version: ObligationVersion = {
    id: uuid(),
    obligationId: obligation.id,
    seq: 1,
    title: t.titulo,
    body: t.detalle,
    phase: null,
    frequency: t.frecuencia,
    expectedEvidence: t.evidencia,
    dueDate: t.venc ?? null,
    dueRule: null,
    attributes: {},
    amendmentNote: t.rectificado ?? null,
    edited: false,
    status,
    validatedBy,
    validatedAt: validatedBy ? at : null,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    causedByDocumentId: doc?.id ?? null,
    sources: doc
      ? [
          {
            documentId: doc.id,
            documentNumber: doc.number,
            sectionKey: t.fuente.ref,
            page: null,
            charStart: null,
            charEnd: null,
            quote: "",
            verified: false,
          },
        ]
      : [],
    createdAt: at,
  };
  db.obligations.push(obligation);
  db.versions.push(version);
  return version;
}

interface DemoAuditOpts {
  title: string;
  plannedOn: string;
  publishedAt: string;
  closedAt?: string;
  results: Record<string, AuditResult>;
  notes: Record<string, string>;
}

const VALIDADOR = "Encargada de Cumplimiento Normativo";
const EVALUADOR = "Jefe de piscicultura";

/** Ejemplo para presentar: Aucha con una auditoría cerrada (Q3) y otra en terreno (Q4). */
export function exampleDb(): DemoDb {
  const db = emptyDb();
  const aucha = db.facilities[0];
  const validatedAt = "2026-07-09T15:30:00Z";
  const versions = REQ_TEMPLATES.map((t) =>
    addObligation(db, aucha.id, t, "validated", VALIDADOR, validatedAt),
  );
  const versionOf = (key: string) =>
    versions[REQ_TEMPLATES.findIndex((t) => t.id === key)];

  const addAudit = (o: DemoAuditOpts) => {
    const audit: DemoAudit = {
      id: uuid(),
      facilityId: aucha.id,
      authorityId: null,
      title: o.title,
      kind: "interna",
      periodFrom: null,
      periodTo: null,
      plannedOn: o.plannedOn,
      status: o.closedAt ? "closed" : "published",
      createdByName: VALIDADOR,
      validatedByName: VALIDADOR,
      excludedCategories: [],
      createdAt: `${o.plannedOn}T10:00:00Z`,
      publishedAt: `${o.publishedAt}T15:30:00Z`,
      closedAt: o.closedAt ? `${o.closedAt}T18:00:00Z` : null,
      clientId: null,
    };
    db.audits.push(audit);
    REQ_TEMPLATES.forEach((t, i) => {
      const result = o.results[t.id] ?? "pending";
      const version = versionOf(t.id);
      const item: DemoItem = {
        id: uuid(),
        auditId: audit.id,
        obligationId: version.obligationId,
        versionId: version.id,
        position: i + 1,
        result,
        notes:
          o.notes[t.id] ??
          (result === "non_compliant"
            ? "Hallazgo registrado en terreno; ver evidencia."
            : null),
        naReason:
          result === "not_applicable"
            ? ("activity_not_performed" as NaReason)
            : null,
        assessedByName: result === "pending" ? null : EVALUADOR,
        assessedAt: result === "pending" ? null : `${o.publishedAt}T18:00:00Z`,
      };
      db.items.push(item);
      if (result !== "pending") {
        db.evidence.push({
          id: uuid(),
          auditItemId: item.id,
          obligationId: item.obligationId,
          sha256: "",
          mime: "image/jpeg",
          filename: `evidencia_${t.id.toLowerCase()}.jpg`,
          uploadedByName: EVALUADOR,
          fileUrl: "#",
          thumbUrl: null,
          capturedAt: `${o.publishedAt}T17:00:00Z`,
          clientId: uuid(),
          createdAt: `${o.publishedAt}T17:00:00Z`,
        });
      }
    });
  };

  const q3: Record<string, AuditResult> = {};
  REQ_TEMPLATES.forEach((t, i) => {
    q3[t.id] =
      i % 9 === 4 || i % 13 === 3
        ? "non_compliant"
        : i % 11 === 10
          ? "not_applicable"
          : "compliant";
  });
  addAudit({
    title: "Auditoría interna Q3 2026",
    plannedOn: "2026-07-08",
    publishedAt: "2026-07-10",
    closedAt: "2026-07-24",
    results: q3,
    notes: {
      R06: "Bitácora diaria incompleta en junio.",
      R13: "Ducha lavaojos sin señalética.",
      R22: "Capacitación agendada para agosto.",
    },
  });

  const C = "compliant",
    N = "non_compliant";
  addAudit({
    title: "Auditoría interna Q4 2026",
    plannedOn: "2026-10-14",
    publishedAt: "2026-10-15",
    results: {
      R01: C,
      R02: N,
      R03: C,
      R05: C,
      R06: C,
      R09: C,
      R10: C,
      R11: C,
      R12: N,
      R13: C,
      R16: C,
      R20: N,
      R21: C,
      R27: C,
      R28: N,
      R30: C,
      R35: "not_applicable",
    },
    notes: {
      R02: "Grupos de 635 y 750 kVA con silenciador nuevo; falta el de 50 kVA en L2.",
      R12: "Faltan registros de pH de 3 días de la semana pasada.",
      R20: "Limpieza realizada, pero falta la guía de despacho de septiembre.",
      R28: "Envases de aerosol con fecha de ingreso de marzo 2026 (más de 6 meses).",
    },
  });

  return db;
}
