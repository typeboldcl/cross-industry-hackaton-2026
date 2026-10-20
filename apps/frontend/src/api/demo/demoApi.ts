import type {
  AuditDetail,
  AuditItem,
  AuditResult,
  AuditSummary,
  FacilityListItem,
  HistoryEntry,
  ObligationListItem,
  ObligationVersion,
} from "@hackaton/contracts";
import { toThumbnail } from "../../domain/evidencia";
import { useSession } from "../../store/useSession";
import { ApiError, type AuditApi } from "../types";
import {
  type DemoAudit,
  type DemoDb,
  type DemoItem,
  loadDb,
  saveDb,
} from "./db";
import { emptyDb, exampleDb, extractAuchaDrafts } from "./seed";
import { uuid } from "../../domain/uuid";

/*
 * Backend simulado en el navegador. Responde con los mismos contratos y aplica
 * las mismas reglas que `apps/backend` (validaciones, estados, X-Actor-Name),
 * para que lo que funcione aquí funcione igual contra el servidor real.
 */

let db: DemoDb = loadDb() ?? emptyDb();

const now = () => new Date().toISOString();
/** Un poco de latencia para que la interfaz muestre sus estados de carga. */
const delay = () => new Promise((r) => setTimeout(r, 60));

/** Ejecuta una operación y guarda; si falla, no queda nada a medias. */
async function tx<T>(fn: (db: DemoDb) => T): Promise<T> {
  await delay();
  const draft = structuredClone(db);
  const result = fn(draft);
  db = draft;
  saveDb(db);
  return structuredClone(result);
}

async function read<T>(fn: (db: DemoDb) => T): Promise<T> {
  await delay();
  return structuredClone(fn(db));
}

const bad = (msg: string) => new ApiError(400, msg);
const notFound = (msg: string) => new ApiError(404, msg);
const conflict = (msg: string) => new ApiError(409, msg);

function actor(): string {
  const name = useSession.getState().actorName.trim();
  if (!name)
    throw bad("Indica quién realiza la acción en el encabezado X-Actor-Name.");
  return name;
}

// ---------------------------------------------------------------------------
// Armado de respuestas
// ---------------------------------------------------------------------------

const authority = (d: DemoDb, id: string | null) =>
  d.authorities.find((a) => a.id === id) ?? null;

function counts(d: DemoDb, auditId: string): Record<AuditResult, number> {
  const c = { compliant: 0, non_compliant: 0, not_applicable: 0, pending: 0 };
  d.items.filter((i) => i.auditId === auditId).forEach((i) => c[i.result]++);
  return c;
}

function summary(d: DemoDb, a: DemoAudit): AuditSummary {
  const { authorityId, clientId: _clientId, ...rest } = a;
  return {
    ...rest,
    authority: authority(d, authorityId),
    itemCounts: counts(d, a.id),
  };
}

function toItem(d: DemoDb, i: DemoItem): AuditItem {
  const { versionId, ...rest } = i;
  const version = d.versions.find((v) => v.id === versionId)!;
  const evidence = d.evidence.filter((e) => e.auditItemId === i.id);
  return {
    ...rest,
    version,
    evidence,
    history: historyOf(d, i, version, evidence),
  };
}

const RESULT_TEXT: Record<AuditResult, string> = {
  compliant: "Cumple",
  non_compliant: "No cumple",
  not_applicable: "No aplica",
  pending: "Pendiente",
};

/** Igual que `historyOf` del backend: se arma con lo que registra cada paso. */
function historyOf(
  d: DemoDb,
  i: DemoItem,
  v: ObligationVersion,
  evidence: AuditItem["evidence"],
): HistoryEntry[] {
  const manual =
    d.obligations.find((o) => o.id === v.obligationId)?.origin === "manual";
  const audit = d.audits.find((a) => a.id === i.auditId);
  const entries: HistoryEntry[] = [
    {
      at: v.createdAt,
      actorName: manual ? (v.validatedBy ?? "Responsable") : "Sistema",
      summary: manual
        ? "Agregado manualmente"
        : "Propuesto por la extracción del documento",
    },
  ];
  if (v.validatedAt) {
    entries.push({
      at: v.validatedAt,
      actorName: v.validatedBy ?? "Responsable",
      summary: v.edited ? "Editado y validado" : "Validado",
    });
  }
  if (audit?.publishedAt) {
    entries.push({
      at: audit.publishedAt,
      actorName: audit.validatedByName ?? "Responsable",
      summary: `Incluido en «${audit.title}»`,
    });
  }
  for (const e of evidence) {
    entries.push({
      at: e.createdAt,
      actorName: e.uploadedByName ?? "Equipo en terreno",
      summary: `Evidencia agregada: ${e.filename ?? "archivo"}`,
    });
  }
  if (i.assessedAt && i.result !== "pending") {
    const detail = i.result === "not_applicable" ? i.naReason : i.notes;
    entries.push({
      at: i.assessedAt,
      actorName: i.assessedByName ?? "Equipo en terreno",
      summary: `Marcado como «${RESULT_TEXT[i.result]}»${detail ? `: ${detail}` : ""}`,
    });
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

function detail(d: DemoDb, id: string): AuditDetail {
  const a = auditOf(d, id);
  return {
    ...summary(d, a),
    items: d.items
      .filter((i) => i.auditId === id)
      .sort((x, y) => x.position - y.position)
      .map((i) => toItem(d, i)),
  };
}

function auditOf(d: DemoDb, id: string): DemoAudit {
  const a = d.audits.find((x) => x.id === id);
  if (!a) throw notFound("Auditoría no encontrada.");
  return a;
}

function writable(d: DemoDb, id: string): DemoAudit {
  const a = auditOf(d, id);
  if (a.status === "closed") throw conflict("La auditoría está cerrada.");
  return a;
}

function versionOf(d: DemoDb, id: string): ObligationVersion {
  const v = d.versions.find((x) => x.id === id);
  if (!v) throw notFound("Versión de requisito no encontrada.");
  return v;
}

/** Versión vigente de un requisito: la más nueva que no fue reemplazada. */
function currentVersion(d: DemoDb, obligationId: string) {
  return d.versions
    .filter((v) => v.obligationId === obligationId && v.status !== "superseded")
    .sort((a, b) => b.seq - a.seq)[0];
}

function itemOf(d: DemoDb, id: string): DemoItem {
  const i = d.items.find((x) => x.id === id);
  if (!i) throw notFound("Ítem de auditoría no encontrado.");
  return i;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const demoApi: AuditApi = {
  facilities: {
    list: () =>
      read((d) =>
        d.facilities.map((f): FacilityListItem => {
          const audits = d.audits.filter((a) => a.facilityId === f.id);
          const latest = audits
            .filter((a) => a.status === "published" || a.status === "closed")
            .sort((a, b) =>
              (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
            )[0];
          const c = latest ? counts(d, latest.id) : null;
          const assessed = c ? c.compliant + c.non_compliant : 0;
          return {
            ...f,
            summary: {
              score: c && assessed ? c.compliant / assessed : null,
              audits: audits.length,
              openAudits: audits.filter((a) => a.status !== "closed").length,
            },
          };
        }),
      ),
    get: (id) =>
      read((d) => {
        const f = d.facilities.find((x) => x.id === id);
        if (!f) throw notFound("Instalación no encontrada.");
        return f;
      }),
    context: (id) =>
      read((d) => {
        const facility = d.facilities.find((x) => x.id === id);
        if (!facility) throw notFound("Instalación no encontrada.");
        return {
          facility,
          documents: d.documents.filter((x) => x.facilityId === id),
          pertinencias: d.pertinencias
            .filter((p) => p.facilityId === id)
            .map(({ facilityId: _f, ...p }) => p),
          pertinenciasError: null,
          alerts: d.alerts
            .filter((a) => a.facilityId === id)
            .map(({ facilityId: _f, ...a }) => a),
          audits: d.audits
            .filter((a) => a.facilityId === id)
            .sort((a, b) => b.plannedOn.localeCompare(a.plannedOn))
            .map((a) => summary(d, a)),
        };
      }),
    authorities: () => read((d) => d.authorities),
  },

  documents: {
    upload: (facilityId, file, kind, title) =>
      tx((d) => {
        const at = now();
        const doc = {
          id: uuid(),
          facilityId,
          kind,
          number: null,
          title: title || file.name,
          issuedOn: null,
          issuer: null,
          origin: "uploaded" as const,
          textExtractedAt: null,
          createdAt: at,
          processingStatus: "done" as const,
          status: "info" as const,
          statusNote: "Cargado en modo demo: no se procesa",
        };
        d.documents.push(doc);
        return {
          ...doc,
          mime: file.type || "application/pdf",
          sha256: "",
          sourceUrl: null,
          pageCount: null,
          extraction: null,
        };
      }),
    import: (facilityId, req) =>
      tx((d) => {
        const at = now();
        const pert = d.pertinencias.find((p) => p.url === req.url);
        const doc = {
          id: uuid(),
          facilityId,
          kind: req.kind,
          number: null,
          title: req.title ?? pert?.name ?? req.url,
          issuedOn: null,
          issuer: null,
          origin: "fetched" as const,
          textExtractedAt: at,
          createdAt: at,
          processingStatus: "done" as const,
          status: "ok" as const,
          statusNote: "Descargado del SEIA",
        };
        d.documents.push(doc);
        if (pert) {
          pert.loaded = true;
          pert.documentId = doc.id;
        }
        return {
          ...doc,
          mime: "application/pdf",
          sha256: "",
          sourceUrl: req.url,
          pageCount: null,
          extraction: null,
        };
      }),
  },

  obligations: {
    list: (facilityId) =>
      read((d) =>
        d.obligations
          .filter((o) => o.facilityId === facilityId)
          .map((o): ObligationListItem | null => {
            const version = currentVersion(d, o.id);
            if (!version) return null;
            return {
              obligationId: o.id,
              key: o.key,
              origin: o.origin,
              category: o.category,
              authority: authority(d, o.authorityId)!,
              version,
              currentVersionId:
                version.status === "validated" ? version.id : null,
            };
          })
          .filter((x): x is ObligationListItem => x !== null),
      ),
    updateDraft: (id, req) =>
      tx((d) => {
        const v = versionOf(d, id);
        if (v.status !== "draft")
          throw conflict("Solo se editan requisitos en borrador.");
        Object.assign(v, req, { edited: true });
        return v;
      }),
    validate: (id) =>
      tx((d) => {
        const by = actor();
        const v = versionOf(d, id);
        if (v.status !== "draft")
          throw conflict("Solo se validan requisitos en borrador.");
        Object.assign(v, {
          status: "validated",
          validatedBy: by,
          validatedAt: now(),
        });
        return v;
      }),
    reject: (id) =>
      tx((d) => {
        actor();
        const v = versionOf(d, id);
        if (v.status !== "draft" && v.status !== "validated")
          throw conflict("Este requisito no se puede descartar.");
        Object.assign(v, {
          status: "rejected",
          validatedBy: null,
          validatedAt: null,
        });
        return v;
      }),
    restore: (id) =>
      tx((d) => {
        actor();
        const v = versionOf(d, id);
        if (v.status !== "rejected")
          throw conflict("Solo se restauran requisitos descartados.");
        v.status = "draft";
        return v;
      }),
  },

  audits: {
    list: (facilityId) =>
      read((d) =>
        d.audits
          .filter((a) => a.facilityId === facilityId)
          .sort((a, b) => b.plannedOn.localeCompare(a.plannedOn))
          .map((a) => summary(d, a)),
      ),
    get: (id) => read((d) => detail(d, id)),
    create: (req) =>
      tx((d) => {
        if (req.clientId) {
          const replay = d.audits.find((a) => a.clientId === req.clientId);
          if (replay) return detail(d, replay.id);
        }
        if (!req.title.trim()) throw bad("La auditoría necesita un nombre.");
        const audit: DemoAudit = {
          id: uuid(),
          facilityId: req.facilityId,
          authorityId: req.authorityId ?? null,
          title: req.title.trim(),
          kind: req.kind,
          periodFrom: req.periodFrom ?? null,
          periodTo: req.periodTo ?? null,
          plannedOn: req.plannedOn,
          status: "draft",
          createdByName: useSession.getState().actorName.trim() || null,
          validatedByName: null,
          excludedCategories: [],
          createdAt: now(),
          publishedAt: null,
          closedAt: null,
          clientId: req.clientId ?? null,
        };
        d.audits.push(audit);
        return detail(d, audit.id);
      }),
    generate: (id) =>
      tx((d) => {
        const a = writable(d, id);
        // En el backend real los requisitos ya se extrajeron al subir cada
        // documento. Aquí se simula esa extracción la primera vez, solo en Aucha.
        const facility = d.facilities.find((f) => f.id === a.facilityId);
        const hasObligations = d.obligations.some(
          (o) => o.facilityId === a.facilityId,
        );
        if (!hasObligations && facility?.externalCodes.demo === "aucha") {
          extractAuchaDrafts(d, a.facilityId);
        }
        if (a.status === "draft") a.status = "in_validation";
        return detail(d, id);
      }),
    publish: (id, excludedCategories) =>
      tx((d) => {
        const by = actor();
        const a = writable(d, id);
        if (a.status === "published")
          throw conflict("La auditoría ya está publicada.");
        Object.assign(a, {
          status: "published",
          publishedAt: now(),
          validatedByName: by,
          excludedCategories,
        });
        let position = d.items.filter((i) => i.auditId === id).length;
        d.obligations
          .filter(
            (o) =>
              o.facilityId === a.facilityId &&
              !excludedCategories.includes(o.category),
          )
          .forEach((o) => {
            const v = currentVersion(d, o.id);
            if (v?.status !== "validated") return;
            if (d.items.some((i) => i.auditId === id && i.versionId === v.id))
              return;
            d.items.push(newItem(id, o.id, v.id, ++position));
          });
        return detail(d, id);
      }),
    addManualRequirement: (id, req) =>
      tx((d) => {
        const by = actor();
        const a = writable(d, id);
        if (!req.category.trim() || !req.title.trim() || !req.body.trim())
          throw bad("Completa la temática, el requisito y la descripción.");
        const at = now();
        const obligationId = uuid();
        d.obligations.push({
          id: obligationId,
          facilityId: a.facilityId,
          authorityId:
            req.authorityId ??
            a.authorityId ??
            d.authorities.find((x) => x.code === "SMA")!.id,
          key: `manual/${req.clientId ?? uuid()}`,
          origin: "manual",
          category: req.category.trim(),
          createdAt: at,
        });
        const version: ObligationVersion = {
          id: uuid(),
          obligationId,
          seq: 1,
          title: req.title.trim(),
          body: req.body.trim(),
          phase: null,
          frequency: req.frequency ?? null,
          expectedEvidence: req.expectedEvidence ?? null,
          dueDate: req.dueDate ?? null,
          dueRule: null,
          attributes: {},
          amendmentNote: null,
          edited: false,
          status: "validated",
          validatedBy: by,
          validatedAt: at,
          validFrom: at,
          validTo: null,
          supersedesId: null,
          causedByDocumentId: null,
          sources: [],
          createdAt: at,
        };
        d.versions.push(version);
        const position = d.items.filter((i) => i.auditId === id).length + 1;
        const item = newItem(id, obligationId, version.id, position);
        // Antes de publicar, el requisito queda validado en la instalación y
        // entrará al publicar; después, se agrega directo a la auditoría.
        if (a.status === "published") d.items.push(item);
        return toItem({ ...d, items: [...d.items, item] }, item);
      }),
    markCategoryNotApplicable: (id, category, req) =>
      tx((d) => {
        const by = actor();
        const a = writable(d, id);
        if (a.status !== "published")
          throw conflict("La auditoría todavía no está publicada.");
        if (req.naReason === "other" && !req.notes?.trim())
          throw bad("«Otro motivo» exige una explicación.");
        const ids = new Set(
          d.obligations.filter((o) => o.category === category).map((o) => o.id),
        );
        const items = d.items.filter(
          (i) => i.auditId === id && ids.has(i.obligationId),
        );
        items.forEach((i) =>
          Object.assign(i, {
            result: "not_applicable",
            naReason: req.naReason,
            notes: req.notes ?? null,
            assessedByName: by,
            assessedAt: now(),
          }),
        );
        return items
          .sort((x, y) => x.position - y.position)
          .map((i) => toItem(d, i));
      }),
    close: (id) =>
      tx((d) => {
        const a = writable(d, id);
        Object.assign(a, { status: "closed", closedAt: now() });
        return detail(d, id);
      }),
  },

  items: {
    assess: (id, req) =>
      tx((d) => {
        const by = actor();
        const item = itemOf(d, id);
        const a = writable(d, item.auditId);
        if (a.status !== "published")
          throw conflict("La auditoría todavía no está publicada.");
        if (req.result === "non_compliant" && !req.notes?.trim())
          throw bad("«No cumple» exige una observación.");
        if (req.result === "not_applicable" && !req.naReason)
          throw bad("«No aplica» exige un motivo.");
        if (req.naReason === "other" && !req.notes?.trim())
          throw bad("«Otro motivo» exige una explicación.");
        Object.assign(item, {
          result: req.result,
          notes: req.notes ?? null,
          naReason: req.result === "not_applicable" ? req.naReason : null,
          assessedByName: by,
          assessedAt: now(),
        });
        return toItem(d, item);
      }),
  },

  evidence: {
    async upload(itemId, file, clientId, capturedAt) {
      const thumbUrl = file.type.startsWith("image/")
        ? await toThumbnail(file)
        : null;
      return tx((d) => {
        const replay = d.evidence.find((e) => e.clientId === clientId);
        if (replay) return replay;
        const item = itemOf(d, itemId);
        writable(d, item.auditId);
        const at = now();
        const evidence = {
          id: uuid(),
          auditItemId: itemId,
          obligationId: item.obligationId,
          sha256: "",
          mime: file.type || "application/octet-stream",
          filename: file.name || "foto.jpg",
          uploadedByName: useSession.getState().actorName.trim() || null,
          fileUrl: thumbUrl ?? "#",
          thumbUrl,
          capturedAt: capturedAt ?? at,
          clientId,
          createdAt: at,
        };
        d.evidence.push(evidence);
        return evidence;
      });
    },
    remove: (id) =>
      tx((d) => {
        d.evidence = d.evidence.filter((e) => e.id !== id);
      }),
  },
};

function newItem(
  auditId: string,
  obligationId: string,
  versionId: string,
  position: number,
): DemoItem {
  return {
    id: uuid(),
    auditId,
    obligationId,
    versionId,
    position,
    result: "pending",
    notes: null,
    naReason: null,
    assessedByName: null,
    assessedAt: null,
  };
}

/** Solo en modo demo: cargar el ejemplo de Aucha o volver al estado inicial. */
export const demoControls = {
  async loadExample() {
    await delay();
    db = exampleDb();
    saveDb(db);
  },
  async reset() {
    await delay();
    db = emptyDb();
    saveDb(db);
  },
  hasAudits: () => db.audits.length > 0,
};
