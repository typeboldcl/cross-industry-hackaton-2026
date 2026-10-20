import type { Auditoria, RequisitoExtraido } from "@hackaton/contracts";
import { REQ_TEMPLATES } from "../data/seed";
import { docById } from "./auditoria";
import { fmtDate } from "./format";

export interface MensajeChat {
  me: boolean;
  text: string;
  src?: string;
}

const STOP = new Set(
  "el la los las de del y o a en que por para con un una se es al lo como cual cuando cuál cuándo qué que hay debo tengo sobre su sus me mi más".split(
    " ",
  ),
);
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Búsqueda por palabras clave en los requisitos de la auditoría abierta.
 * En producción esto se reemplaza por un LLM con recuperación (RAG) sobre los
 * documentos del centro, manteniendo la cita obligatoria de la fuente.
 */
export function botAnswer(q: string, a: Auditoria | null): MensajeChat {
  const tokens = norm(q)
    .split(/[^a-z0-9ñ]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
  const pool: RequisitoExtraido[] = a && a.reqs.length ? a.reqs : REQ_TEMPLATES;
  const scored = pool
    .map((r) => {
      const hay = norm(`${r.titulo} ${r.tema} ${r.detalle} ${r.frecuencia}`);
      const titulo = norm(r.titulo);
      return {
        r,
        s: tokens.reduce(
          (n, t) => n + (hay.includes(t) ? (titulo.includes(t) ? 2 : 1) : 0),
          0,
        ),
      };
    })
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .slice(0, 2);
  if (!scored.length) {
    return {
      me: false,
      text: "No encontré un requisito relacionado en los documentos cargados. Prueba con palabras como “ruido”, “lodos”, “RESPEL”, “playa” o “declaración”.",
    };
  }
  const r = scored[0].r;
  const d = docById(r.fuente.doc, a);
  let text = `${r.titulo}\n${r.detalle}\nFrecuencia: ${r.frecuencia}. Evidencia esperada: ${r.evidencia}.`;
  if (r.venc) text += `\nPróximo vencimiento: ${fmtDate(r.venc)}.`;
  if (scored[1]) text += `\n\nTambién relacionado: ${scored[1].r.titulo}.`;
  return {
    me: false,
    text,
    src: `Fuente: ${d.tipo} ${d.numero} · ${r.fuente.ref}`,
  };
}
