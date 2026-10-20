import type {
  DocumentKind,
  DocumentProcessingStatus,
  DocumentStatus,
  FacilityAlert,
  FacilityPertinencia,
  SeiaPertinencia,
} from "@hackaton/contracts";
import { normalizeDocumentNumber } from "../documents/document-number.js";

export interface DocumentFacts {
  id: string;
  kind: DocumentKind;
  number: string | null;
  title: string;
  processingStatus: DocumentProcessingStatus;
  processingError: string | null;
  sectionsDone: number;
  sectionsTotal: number;
}

export interface DerivedStatus {
  status: DocumentStatus;
  statusNote: string | null;
}

export interface DocumentReference {
  number: string;
  label: string;
}

export interface CitingDocument {
  id: string;
  number: string | null;
  title: string;
  pages: string[];
}

const GENERIC_NAME_WORDS = new Set([
  "piscicultura",
  "centro",
  "cultivo",
  "planta",
  "proyecto",
  "sociedad",
]);
const MIN_DISTINCTIVE_LENGTH = 4;
const RCA_REFERENCE =
  /\bRCA\s+N[°º]?\s*(\d{1,4})\s+de\s+fecha\s+\d{1,2}\/\d{1,2}\/(\d{4})/gi;
const RESOLUTION_REFERENCE =
  /Resoluci[oó]n\s+Exenta\s+N[°º]?\s*:?\s*(\d[\d/.-]*\d)/gi;
const PERTINENCIA_ID = /^PERTI-\d{4}-\d+$/;
const CITED_PERTINENCIA_ID = /PERTI[-_]\s*(\d{4})\s*-\s*(\d+)/i;
const CITATION_CONTEXT_LENGTH = 400;
const NEXT_LISTED_ITEM = /\n\s*(?:\d+[.°)]|-)\s/;
const MIN_NAME_WORDS = 3;
const MIN_NAME_COVERAGE = 0.8;

export function deriveDocumentStatus(
  document: DocumentFacts,
  all: DocumentFacts[],
): DerivedStatus {
  if (document.processingStatus === "failed") {
    return {
      status: "warn",
      statusNote: `Extracción incompleta: ${document.processingError ?? "error desconocido"}`,
    };
  }

  if (
    document.processingStatus === "processing" ||
    document.processingStatus === "queued"
  ) {
    return {
      status: "info",
      statusNote: `Procesando ${document.sectionsDone} de ${document.sectionsTotal} secciones`,
    };
  }

  if (document.kind === "rca") {
    const rectification = all.find((other) => other.kind === "rectificacion");
    if (rectification) {
      return {
        status: "info",
        statusNote: `Rectificada por ${rectification.number ?? rectification.title}`,
      };
    }
  }

  return { status: "ok", statusNote: null };
}

export function pertinenciaUrl(pertinencia: SeiaPertinencia): string {
  return pertinencia.kind === "NEW"
    ? `https://pertinencia.sea.gob.cl/api/public/expediente/${pertinencia.id}`
    : `https://seia.sea.gob.cl/pertinencia/verPertinencia.php?id_pertinencia=${pertinencia.id}`;
}

export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function distinctiveWords(facilityName: string): string[] {
  return foldText(facilityName)
    .split(/[^a-z0-9]+/)
    .filter(
      (word) =>
        word.length >= MIN_DISTINCTIVE_LENGTH && !GENERIC_NAME_WORDS.has(word),
    );
}

export function filterRelevantPertinencias(
  candidates: SeiaPertinencia[],
  facility: { name: string; comuna: string },
): SeiaPertinencia[] {
  const words = distinctiveWords(facility.name);
  const comuna = foldText(facility.comuna).trim();
  const unique = new Map(candidates.map((p) => [p.id, p]));
  return [...unique.values()].filter((pertinencia) => {
    if (
      comuna &&
      pertinencia.comuna &&
      foldText(pertinencia.comuna).trim() !== comuna
    ) {
      return false;
    }
    if (words.length === 0) return true;
    const nameWords = new Set(wordsOf(pertinencia.name));
    return words.some((word) => nameWords.has(word));
  });
}

function wordsOf(value: string): string[] {
  return foldText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function toFacilityPertinencias(
  pertinencias: SeiaPertinencia[],
  documents: Pick<DocumentFacts, "id" | "kind" | "number">[],
): FacilityPertinencia[] {
  const loadedById = new Map(
    documents
      .filter((document) => document.kind === "pertinencia" && document.number)
      .map((document) => [document.number, document.id]),
  );
  return pertinencias.map((pertinencia) => {
    const documentId = loadedById.get(pertinencia.id) ?? null;
    return {
      ...pertinencia,
      loaded: documentId !== null,
      documentId,
      url: pertinenciaUrl(pertinencia),
    };
  });
}

export function extractReferences(
  pages: string[],
  pertinencias: Pick<SeiaPertinencia, "id" | "name">[] = [],
): DocumentReference[] {
  const text = pages.join("\n");
  const references: DocumentReference[] = [];

  for (const match of text.matchAll(RCA_REFERENCE)) {
    const number = normalizeDocumentNumber(`${match[1]}/${match[2]}`);
    if (number) references.push({ number, label: `RCA N° ${number}` });
  }
  for (const match of text.matchAll(RESOLUTION_REFERENCE)) {
    const number = normalizeDocumentNumber(match[1] ?? "");
    if (!number) continue;
    const label = `Resolución Exenta N° ${number}`;
    const pertinenciaId = citedPertinencia(
      citationContext(text, match.index + match[0].length),
      pertinencias,
    );
    references.push(
      pertinenciaId
        ? {
            number: pertinenciaId,
            label: `pertinencia ${pertinenciaId} (${label})`,
          }
        : { number, label },
    );
  }
  return references;
}

function citationContext(text: string, from: number): string {
  const following = text.slice(from, from + CITATION_CONTEXT_LENGTH);
  const end = following.search(NEXT_LISTED_ITEM);
  return end === -1 ? following : following.slice(0, end);
}

function citedPertinencia(
  context: string,
  pertinencias: Pick<SeiaPertinencia, "id" | "name">[],
): string | null {
  const cited = CITED_PERTINENCIA_ID.exec(context);
  if (cited) return `PERTI-${cited[1]}-${cited[2]}`;

  const folded = foldText(context).replace(/\s+/g, " ");
  let best: { id: string; coverage: number } | null = null;
  for (const pertinencia of pertinencias) {
    const words = wordsOf(pertinencia.name).filter(
      (word) => word.length >= MIN_DISTINCTIVE_LENGTH,
    );
    if (words.length < MIN_NAME_WORDS) continue;
    const coverage =
      words.filter((word) => folded.includes(word)).length / words.length;
    if (coverage >= MIN_NAME_COVERAGE && coverage > (best?.coverage ?? 0)) {
      best = { id: pertinencia.id, coverage };
    }
  }
  return best?.id ?? null;
}

function referenceKey(raw: string): string | null {
  return PERTINENCIA_ID.test(raw) ? raw : normalizeDocumentNumber(raw);
}

export function missingReferenceAlerts(
  documents: CitingDocument[],
  loadedNumbers: Iterable<string | null>,
  pertinencias: Pick<SeiaPertinencia, "id" | "name">[] = [],
): FacilityAlert[] {
  const loaded = new Set<string>();
  for (const raw of loadedNumbers) {
    const number = raw ? referenceKey(raw) : null;
    if (number) loaded.add(number);
  }

  const alerts = new Map<string, FacilityAlert>();
  for (const document of documents) {
    const own = document.number ? referenceKey(document.number) : null;
    for (const reference of extractReferences(document.pages, pertinencias)) {
      const id = `missing-ref:${reference.number}`;
      if (reference.number === own || loaded.has(reference.number)) continue;
      if (alerts.has(id)) continue;
      alerts.set(id, {
        id,
        kind: "warn",
        title: "Documento citado no cargado",
        text: `"${document.title}" cita la ${reference.label}, que no está cargada para esta instalación.`,
        documentId: document.id,
      });
    }
  }
  return [...alerts.values()];
}

export function buildSummaryAlerts(input: {
  unloadedPertinencias: number;
  draftVersions: number;
  failedDocuments: Pick<DocumentFacts, "id" | "title" | "processingError">[];
}): { failed: FacilityAlert[]; info: FacilityAlert[] } {
  const failed = input.failedDocuments.map((document): FacilityAlert => ({
    id: `processing-failed:${document.id}`,
    kind: "bad",
    title: "Falló el procesamiento",
    text: `"${document.title}": ${document.processingError ?? "error desconocido"}`,
    documentId: document.id,
  }));

  const info: FacilityAlert[] = [];
  if (input.unloadedPertinencias > 0) {
    info.push({
      id: "pertinencias-unloaded",
      kind: "info",
      title: "Pertinencias sin cargar",
      text: `Hay ${input.unloadedPertinencias} pertinencia(s) detectada(s) en el SEIA que aún no están cargadas.`,
      documentId: null,
    });
  }
  if (input.draftVersions > 0) {
    info.push({
      id: "requirements-to-validate",
      kind: "info",
      title: "Requisitos por validar",
      text: `Hay ${input.draftVersions} requisito(s) en borrador pendientes de validación.`,
      documentId: null,
    });
  }
  return { failed, info };
}
