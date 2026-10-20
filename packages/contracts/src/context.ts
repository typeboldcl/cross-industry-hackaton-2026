import type { AuditSummary } from "./audits.js";
import type { DocumentProcessingStatus, DocumentSummary } from "./documents.js";
import type { Facility } from "./facilities.js";
import type { SeiaPertinencia } from "./seia.js";

export type DocumentStatus = "ok" | "warn" | "info";

export type FacilityDocument = DocumentSummary & {
  processingStatus: DocumentProcessingStatus;
  sectionsDone: number;
  sectionsTotal: number;
  status: DocumentStatus;
  statusNote: string | null;
};

export type FacilityPertinencia = SeiaPertinencia & {
  loaded: boolean;
  documentId: string | null;
  url: string;
};

export type AlertKind = "warn" | "info" | "bad";

export type FacilityAlert = {
  id: string;
  kind: AlertKind;
  title: string;
  text: string;
  documentId: string | null;
};

export type FacilityContext = {
  facility: Facility;
  documents: FacilityDocument[];
  pertinencias: FacilityPertinencia[];
  pertinenciasError: string | null;
  alerts: FacilityAlert[];
  audits: AuditSummary[];
};
