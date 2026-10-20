import type {
  AuditItem,
  AuditResult,
  AuditSummary,
  ObligationListItem,
  ObligationVersion,
} from "@hackaton/contracts";

export interface Stats {
  total: number;
  compliant: number;
  non_compliant: number;
  not_applicable: number;
  pending: number;
  /** Ítems con resultado (todo menos pendiente). */
  filled: number;
  /** Avance de la auditoría, 0–100. */
  progress: number;
  /** Cumplimiento = cumple / (cumple + no cumple). N/A no cuenta. */
  pct: number | null;
}

export function statsFromCounts(
  c: Partial<Record<AuditResult, number>>,
): Stats {
  const compliant = c.compliant ?? 0;
  const non_compliant = c.non_compliant ?? 0;
  const not_applicable = c.not_applicable ?? 0;
  const pending = c.pending ?? 0;
  const total = compliant + non_compliant + not_applicable + pending;
  const filled = total - pending;
  const assessed = compliant + non_compliant;
  return {
    total,
    compliant,
    non_compliant,
    not_applicable,
    pending,
    filled,
    progress: total ? Math.round((filled / total) * 100) : 0,
    pct: assessed ? Math.round((compliant / assessed) * 100) : null,
  };
}

export function statsFromItems(items: { result: AuditResult }[]): Stats {
  const c: Record<AuditResult, number> = {
    compliant: 0,
    non_compliant: 0,
    not_applicable: 0,
    pending: 0,
  };
  items.forEach((i) => c[i.result]++);
  return statsFromCounts(c);
}

export const auditStats = (a: AuditSummary) => statsFromCounts(a.itemCounts);

/** Ítem de auditoría con su temática y su código de la planilla (1-a, 1-b…). */
export interface Row {
  item: AuditItem;
  category: string;
  code: string;
}

/**
 * Numeración como la planilla en papel: temáticas 1, 2, 3… por orden de
 * aparición y requisitos 1-a, 1-b… por su posición en la auditoría. Como sale
 * de `position`, el código no cambia al filtrar ni al marcar.
 */
export function numberItems(
  items: AuditItem[],
  categoryOf: (obligationId: string) => string,
): { rows: Row[]; categoryNumber: Record<string, number> } {
  const categoryNumber: Record<string, number> = {};
  const count: Record<string, number> = {};
  let n = 0;
  const rows = [...items]
    .sort((a, b) => a.position - b.position)
    .map((item) => {
      const category = categoryOf(item.obligationId);
      if (!(category in categoryNumber)) {
        categoryNumber[category] = ++n;
        count[category] = 0;
      }
      const k = count[category]++;
      const letter = k < 26 ? String.fromCharCode(97 + k) : `z${k - 25}`;
      return { item, category, code: `${categoryNumber[category]}-${letter}` };
    });
  return { rows, categoryNumber };
}

/** Temática de cada requisito, a partir de la lista de la instalación. */
export function categoryLookup(obligations: ObligationListItem[] | undefined) {
  const map = new Map(obligations?.map((o) => [o.obligationId, o.category]));
  return (obligationId: string) => map.get(obligationId) ?? "Sin temática";
}

/** Orden dentro de cada temática en Terreno: pendientes, Cumple, No cumple y al final N/A. */
export const RESULT_ORDER: Record<AuditResult, number> = {
  pending: 0,
  compliant: 1,
  non_compliant: 2,
  not_applicable: 3,
};

/** Temáticas en orden de aparición. */
export function categoriesOf(list: { category: string }[]): string[] {
  return [...new Set(list.map((r) => r.category))];
}

/** Fuente principal de un requisito, para mostrar "RCA N° … · Cons. 4.3.2". */
export function sourceLabel(v: ObligationVersion): string {
  const s = v.sources[0];
  if (!s) return "Criterio del responsable";
  return [s.documentNumber, s.sectionKey].filter(Boolean).join(" · ");
}
