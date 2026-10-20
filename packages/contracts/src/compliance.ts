import type { AuditResult } from "./audits.js";
import type { Authority } from "./facilities.js";

export type ComplianceState = AuditResult | "never_audited";

export interface FacilityCompliance {
  facilityId: string;
  totals: Record<ComplianceState, number>;
  score: number | null;
  byAuthority: {
    authority: Authority;
    totals: Record<ComplianceState, number>;
    score: number | null;
  }[];
  obligations: {
    obligationId: string;
    title: string;
    authority: Authority;
    state: ComplianceState;
    lastAuditId: string | null;
    lastAssessedAt: string | null;
  }[];
}
