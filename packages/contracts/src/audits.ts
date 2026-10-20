import type { Authority } from "./facilities.js";
import type { ObligationVersion } from "./obligations.js";

export type AuditStatus = "planned" | "in_progress" | "closed";

export type AuditResult =
  "compliant" | "non_compliant" | "not_applicable" | "pending";

export interface CreateAuditRequest {
  facilityId: string;
  authorityId: string;
  kind: string;
  periodFrom: string;
  periodTo: string;
  plannedOn: string;
}

export interface AuditSummary {
  id: string;
  facilityId: string;
  authority: Authority;
  kind: string;
  periodFrom: string;
  periodTo: string;
  plannedOn: string;
  status: AuditStatus;
  itemCounts: Record<AuditResult, number>;
}

export interface AuditItem {
  id: string;
  auditId: string;
  obligationId: string;
  version: ObligationVersion;
  result: AuditResult;
  notes: string | null;
  assessedByName: string | null;
  assessedAt: string | null;
  evidence: Evidence[];
}

export interface AuditDetail extends AuditSummary {
  items: AuditItem[];
}

export interface Evidence {
  id: string;
  auditItemId: string;
  obligationId: string;
  sha256: string;
  mime: string;
  capturedAt: string;
  clientId: string;
  createdAt: string;
}

export interface AddAuditItemRequest {
  obligationVersionId: string;
}

export interface AssessItemRequest {
  result: AuditResult;
  notes?: string | null;
}
