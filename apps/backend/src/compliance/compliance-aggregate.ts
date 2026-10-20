import type {
  AuditResult,
  Authority,
  ComplianceState,
  FacilityCompliance,
} from "@hackaton/contracts";

export interface ComplianceRow {
  obligationId: string;
  title: string;
  authority: Authority;
  result: AuditResult | null;
  lastAuditId: string | null;
  lastAssessedAt: string | null;
}

type AuthorityGroup = {
  authority: Authority;
  totals: Record<ComplianceState, number>;
};

const emptyTotals = (): Record<ComplianceState, number> => ({
  compliant: 0,
  non_compliant: 0,
  not_applicable: 0,
  pending: 0,
  never_audited: 0,
});

const scoreOf = (totals: Record<ComplianceState, number>): number | null => {
  const assessed = totals.compliant + totals.non_compliant;
  return assessed === 0 ? null : totals.compliant / assessed;
};

export function aggregateCompliance(
  facilityId: string,
  rows: ComplianceRow[],
): FacilityCompliance {
  const totals = emptyTotals();
  const groups = new Map<string, AuthorityGroup>();

  const obligations = rows.map((row) => {
    const state: ComplianceState = row.result ?? "never_audited";
    totals[state] += 1;

    let group = groups.get(row.authority.code);
    if (!group) {
      group = { authority: row.authority, totals: emptyTotals() };
      groups.set(row.authority.code, group);
    }
    group.totals[state] += 1;

    return {
      obligationId: row.obligationId,
      title: row.title,
      authority: row.authority,
      state,
      lastAuditId: row.lastAuditId,
      lastAssessedAt: row.lastAssessedAt,
    };
  });

  const byAuthority = [...groups.values()]
    .sort((a, b) => a.authority.code.localeCompare(b.authority.code))
    .map((group) => ({
      authority: group.authority,
      totals: group.totals,
      score: scoreOf(group.totals),
    }));

  return {
    facilityId,
    totals,
    score: scoreOf(totals),
    byAuthority,
    obligations,
  };
}
