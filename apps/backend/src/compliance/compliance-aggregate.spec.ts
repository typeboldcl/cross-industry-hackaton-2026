import { aggregateCompliance } from "./compliance-aggregate.js";
import type { ComplianceRow } from "./compliance-aggregate.js";
import type { Authority } from "@hackaton/contracts";

const sag = { code: "SAG" } as Authority;
const dma = { code: "DMA" } as Authority;

const row = (overrides: Partial<ComplianceRow> = {}): ComplianceRow => ({
  obligationId: "ob-1",
  title: "Obligation",
  authority: sag,
  result: null,
  lastAuditId: null,
  lastAssessedAt: null,
  ...overrides,
});

describe("aggregateCompliance", () => {
  it("aggregates mixed results across two authorities", () => {
    const result = aggregateCompliance("fac-1", [
      row({
        obligationId: "ob-1",
        title: "Informe sanitario",
        result: "compliant",
        lastAuditId: "a-1",
        lastAssessedAt: "2026-01-10",
      }),
      row({ obligationId: "ob-2", result: "non_compliant" }),
      row({ obligationId: "ob-3" }),
      row({ obligationId: "ob-4", authority: dma, result: "compliant" }),
      row({ obligationId: "ob-5", authority: dma, result: "pending" }),
      row({ obligationId: "ob-6", authority: dma, result: "not_applicable" }),
    ]);

    expect(result.facilityId).toBe("fac-1");
    expect(result.totals).toEqual({
      compliant: 2,
      non_compliant: 1,
      not_applicable: 1,
      pending: 1,
      never_audited: 1,
    });
    expect(result.score).toBeCloseTo(2 / 3);
    expect(result.byAuthority.map((a) => a.authority.code)).toEqual([
      "DMA",
      "SAG",
    ]);
    expect(result.byAuthority[0].totals).toEqual({
      compliant: 1,
      non_compliant: 0,
      not_applicable: 1,
      pending: 1,
      never_audited: 0,
    });
    expect(result.byAuthority[0].score).toBe(1);
    expect(result.byAuthority[1].score).toBe(0.5);
    expect(result.obligations[0]).toEqual({
      obligationId: "ob-1",
      title: "Informe sanitario",
      authority: sag,
      state: "compliant",
      lastAuditId: "a-1",
      lastAssessedAt: "2026-01-10",
    });
    expect(result.obligations.map((o) => [o.obligationId, o.state])).toEqual([
      ["ob-1", "compliant"],
      ["ob-2", "non_compliant"],
      ["ob-3", "never_audited"],
      ["ob-4", "compliant"],
      ["ob-5", "pending"],
      ["ob-6", "not_applicable"],
    ]);
  });

  it("returns zeroed totals for empty input", () => {
    const result = aggregateCompliance("fac-2", []);

    expect(result.totals).toEqual({
      compliant: 0,
      non_compliant: 0,
      not_applicable: 0,
      pending: 0,
      never_audited: 0,
    });
    expect(result.score).toBeNull();
    expect(result.byAuthority).toEqual([]);
    expect(result.obligations).toEqual([]);
  });

  it("scores null when rows are only pending or not applicable", () => {
    const result = aggregateCompliance("fac-3", [
      row({ obligationId: "ob-1", result: "pending" }),
      row({ obligationId: "ob-2", result: "not_applicable" }),
    ]);

    expect(result.score).toBeNull();
    expect(result.byAuthority[0].score).toBeNull();
  });

  it("counts rows without a result as never audited", () => {
    const result = aggregateCompliance("fac-4", [
      row({ obligationId: "ob-1" }),
      row({ obligationId: "ob-2" }),
    ]);

    expect(result.totals).toEqual({
      compliant: 0,
      non_compliant: 0,
      not_applicable: 0,
      pending: 0,
      never_audited: 2,
    });
    expect(result.score).toBeNull();
    expect(result.obligations.every((o) => o.state === "never_audited")).toBe(
      true,
    );
  });
});
