import type { Authority } from "./facilities.js";

export type ObligationStatus = "draft" | "validated" | "superseded" | "revoked";

export type Phase = "construccion" | "operacion" | "cierre";

export interface ObligationSource {
  documentId: string;
  documentNumber: string | null;
  sectionKey: string;
  page: number | null;
  charStart: number | null;
  charEnd: number | null;
  quote: string;
  verified: boolean;
}

export interface ObligationVersion {
  id: string;
  obligationId: string;
  seq: number;
  title: string;
  body: string;
  phase: Phase | null;
  frequency: string | null;
  expectedEvidence: string | null;
  dueDate: string | null;
  dueRule: Record<string, unknown> | null;
  attributes: Record<string, unknown>;
  status: ObligationStatus;
  validatedBy: string | null;
  validatedAt: string | null;
  validFrom: string | null;
  validTo: string | null;
  supersedesId: string | null;
  causedByDocumentId: string | null;
  sources: ObligationSource[];
  createdAt: string;
}

export interface ObligationListItem {
  obligationId: string;
  key: string;
  category: string;
  authority: Authority;
  version: ObligationVersion;
  currentVersionId: string | null;
}

export interface ObligationDetail {
  id: string;
  facilityId: string;
  key: string;
  category: string;
  authority: Authority;
  versions: ObligationVersion[];
}

export interface UpdateDraftRequest {
  title?: string;
  body?: string;
  phase?: Phase | null;
  frequency?: string | null;
  expectedEvidence?: string | null;
  dueDate?: string | null;
  dueRule?: Record<string, unknown> | null;
  attributes?: Record<string, unknown>;
}

export interface UpdateObligationRequest {
  authorityId?: string;
  category?: string;
}
