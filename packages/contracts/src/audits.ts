import type { Authority } from "./facilities.js";
import type { ObligationVersion } from "./obligations.js";

export type AuditStatus = "draft" | "in_validation" | "published" | "closed";

export type AuditKind = "interna" | "seguimiento" | "externa" | "simulacro_sma";

export type NaReason =
  "activity_not_performed" | "not_current_phase" | "outside_period" | "other";

export type AuditResult =
  "compliant" | "non_compliant" | "not_applicable" | "pending";

export interface CreateAuditRequest {
  facilityId: string;
  title: string;
  kind: AuditKind;
  plannedOn: string;
  authorityId?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  clientId?: string;
}

export interface PublishAuditRequest {
  excludedCategories: string[];
}

export interface AddManualRequirementRequest {
  category: string;
  title: string;
  body: string;
  frequency?: string | null;
  expectedEvidence?: string | null;
  dueDate?: string | null;
  authorityId?: string | null;
  clientId?: string;
}

export interface AuditSummary {
  id: string;
  facilityId: string;
  title: string;
  authority: Authority | null;
  kind: AuditKind;
  periodFrom: string | null;
  periodTo: string | null;
  plannedOn: string;
  status: AuditStatus;
  createdByName: string | null;
  validatedByName: string | null;
  excludedCategories: string[];
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
  itemCounts: Record<AuditResult, number>;
}

export interface HistoryEntry {
  at: string;
  actorName: string;
  summary: string;
}

export interface AuditItem {
  id: string;
  auditId: string;
  obligationId: string;
  version: ObligationVersion;
  position: number;
  result: AuditResult;
  notes: string | null;
  naReason: NaReason | null;
  assessedByName: string | null;
  assessedAt: string | null;
  evidence: Evidence[];
  history: HistoryEntry[];
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
  filename: string | null;
  uploadedByName: string | null;
  fileUrl: string;
  thumbUrl: string | null;
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
  naReason?: NaReason | null;
}

export interface CategoryNotApplicableRequest {
  naReason: NaReason;
  notes?: string | null;
}
