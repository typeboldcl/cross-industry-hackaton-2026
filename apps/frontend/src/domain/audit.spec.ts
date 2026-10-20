import type { AuditItem, AuditResult } from "@hackaton/contracts";
import {
  numberItems,
  RESULT_ORDER,
  statsFromCounts,
  statsFromItems,
} from "./audit";

const item = (
  id: string,
  obligationId: string,
  position: number,
  result: AuditResult = "pending",
) => ({ id, obligationId, position, result }) as AuditItem;

describe("stats", () => {
  it("calcula cumplimiento sin contar N/A ni pendientes", () => {
    const s = statsFromCounts({
      compliant: 3,
      non_compliant: 1,
      not_applicable: 1,
      pending: 1,
    });
    expect(s.pct).toBe(75);
    expect(s.filled).toBe(5);
    expect(s.progress).toBe(83);
  });

  it("devuelve null si no hay nada evaluado", () => {
    expect(
      statsFromItems([item("a", "x", 1, "not_applicable"), item("b", "x", 2)])
        .pct,
    ).toBeNull();
  });
});

describe("numberItems", () => {
  it("numera como la planilla por posición, aunque lleguen desordenados", () => {
    const cat: Record<string, string> = {
      o1: "Ruido",
      o2: "Agua",
      o3: "Ruido",
    };
    const { rows, categoryNumber } = numberItems(
      [item("c", "o3", 3, "compliant"), item("a", "o1", 1), item("b", "o2", 2)],
      (o) => cat[o],
    );
    expect(categoryNumber).toEqual({ Ruido: 1, Agua: 2 });
    expect(Object.fromEntries(rows.map((r) => [r.item.id, r.code]))).toEqual({
      a: "1-a",
      b: "2-a",
      c: "1-b",
    });
  });
});

describe("orden en terreno", () => {
  it("pendientes, luego Cumple, No cumple y N/A", () => {
    const orden = (
      ["not_applicable", "compliant", "pending", "non_compliant"] as const
    )
      .slice()
      .sort((x, y) => RESULT_ORDER[x] - RESULT_ORDER[y]);
    expect(orden).toEqual([
      "pending",
      "compliant",
      "non_compliant",
      "not_applicable",
    ]);
  });
});
