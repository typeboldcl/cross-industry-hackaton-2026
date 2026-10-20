import type {
  Auditoria,
  Documento,
  EstadoTerreno,
  Requisito,
} from "@hackaton/contracts";
import { DOCS_AUCHA, PERT_AUCHA } from "../data/seed";

/** Auditorías de un centro, la más reciente primero. */
export const auditsOf = (audits: Auditoria[], inst: string) =>
  audits
    .filter((a) => a.inst === inst)
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

export const activeReqs = (a: Auditoria | null | undefined): Requisito[] =>
  a ? a.reqs.filter((r) => r.val === "validado") : [];

export interface Stats {
  total: number;
  cumple: number;
  no_cumple: number;
  na: number;
  pendiente: number;
  llenos: number;
  /** Avance de la auditoría, 0–100. */
  avance: number;
  /** Cumplimiento = cumple / (cumple + no cumple). N/A no cuenta. */
  pct: number | null;
}

export function stats(list: Requisito[]): Stats {
  const c: Record<EstadoTerreno, number> = {
    cumple: 0,
    no_cumple: 0,
    na: 0,
    pendiente: 0,
  };
  list.forEach((r) => c[r.estado || "pendiente"]++);
  const evaluados = c.cumple + c.no_cumple;
  const llenos = list.length - c.pendiente;
  return {
    total: list.length,
    ...c,
    llenos,
    avance: list.length ? Math.round((llenos / list.length) * 100) : 0,
    pct: evaluados ? Math.round((c.cumple / evaluados) * 100) : null,
  };
}

const SIN_DOC: Pick<Documento, "numero" | "tipo"> = {
  numero: "",
  tipo: "Criterio del responsable",
};

/** Documento fuente de un requisito, dentro de los documentos de la auditoría. */
export function docById(
  id: string,
  a?: Auditoria | null,
): Pick<Documento, "numero" | "tipo"> & Partial<Documento> {
  if (id === "MANUAL") return SIN_DOC;
  const docs = a ? [...a.docs, ...a.extras] : DOCS_AUCHA;
  const perts = a ? a.perts : PERT_AUCHA;
  return (
    docs.find((d) => d.id === id) ??
    perts
      .map((p) => ({ ...p, tipo: "Pertinencia" }))
      .find((d) => d.id === id) ?? { numero: id, tipo: "" }
  );
}

export interface Numeracion {
  tema: Record<string, number>;
  code: Record<string, string>;
  idx: Record<string, number>;
}

/**
 * Numeración como la planilla en papel: temática 1, 2, 3… e ítems 1-a, 1-b…
 * Se calcula sobre todos los requisitos validados, así el código no cambia al
 * filtrar o marcar.
 */
export function numeracion(a: Auditoria | null | undefined): Numeracion {
  const tema: Record<string, number> = {};
  const code: Record<string, string> = {};
  const idx: Record<string, number> = {};
  const cont: Record<string, number> = {};
  let n = 0;
  activeReqs(a).forEach((r, i) => {
    if (!(r.tema in tema)) {
      tema[r.tema] = ++n;
      cont[r.tema] = 0;
    }
    const k = cont[r.tema]++;
    code[r.id] =
      `${tema[r.tema]}-${k < 26 ? String.fromCharCode(97 + k) : `z${k - 25}`}`;
    idx[r.id] = i;
  });
  return { tema, code, idx };
}

/** Orden dentro de cada temática en Terreno: pendientes, Cumple, No cumple y al final N/A. */
export const ORDEN_ESTADO: Record<EstadoTerreno, number> = {
  pendiente: 0,
  cumple: 1,
  no_cumple: 2,
  na: 3,
};

/** Temáticas en orden de aparición. */
export function temasDe(list: { tema: string }[]): string[] {
  return [...new Set(list.map((r) => r.tema))];
}
