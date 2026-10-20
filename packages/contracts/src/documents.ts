import type { Authority } from "./facilities.js";

export type DocumentKind =
  "rca" | "rectificacion" | "pertinencia" | "res_sanitaria" | "norma" | "otro";

export type DocumentProcessingStatus =
  "uploaded" | "queued" | "processing" | "done" | "failed";

export interface DocumentSummary {
  id: string;
  facilityId: string;
  kind: DocumentKind;
  number: string | null;
  title: string;
  issuedOn: string | null;
  issuer: Authority | null;
  origin: "uploaded" | "fetched";
  textExtractedAt: string | null;
  createdAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  mime: string;
  sha256: string;
  processingStatus: DocumentProcessingStatus;
  sourceUrl: string | null;
  pageCount: number | null;
  extraction: ExtractionProgress | null;
}

export interface UpdateDocumentRequest {
  number?: string | null;
  issuedOn?: string | null;
  title?: string;
  issuerCode?: string | null;
}

export interface ImportDocumentRequest {
  url: string;
  kind: DocumentKind;
  title?: string;
}

export interface ExtractionProgress {
  documentId: string;
  state: DocumentProcessingStatus;
  sectionsTotal: number;
  sectionsDone: number;
  draftsCreated: number;
  error: string | null;
  repealCandidates: RepealCandidate[];
}

export interface RepealCandidate {
  obligationId: string;
  sectionKey: string;
  rationale: string;
}
