import type {
  Auditoria,
  EstadoTerreno,
  Requisito,
  RequisitoExtraido,
} from "@hackaton/contracts";
import { DOCS_AUCHA, PERT_AUCHA, REQ_TEMPLATES } from "../data/seed";
import { docById } from "./auditoria";
import { ESTADOS, NA_MOTIVOS } from "./constants";
import { nowISO } from "./format";

export function newAudit(
  seq: number,
  {
    inst,
    nombre,
    tipo,
    fecha,
  }: Pick<Auditoria, "inst" | "nombre" | "tipo" | "fecha">,
): Auditoria {
  // En el prototipo solo Aucha tiene documentos reales del reto.
  const real = inst === "aucha";
  return {
    id: `A${seq}-${Date.now().toString(36).slice(-4)}`,
    inst,
    nombre,
    tipo,
    fecha,
    creada: nowISO(),
    step: 2,
    docs: real ? DOCS_AUCHA.map((d) => ({ ...d })) : [],
    perts: real ? PERT_AUCHA.map((p) => ({ ...p })) : [],
    extras: [],
    status: "sin_preparar",
    generado: false,
    validador: "",
    publicada: null,
    cerrada: null,
    reqs: [],
    temasOff: [],
  };
}

/** Convierte lo que devuelve la extracción en un requisito propuesto para validar. */
export function fromExtraido(
  t: RequisitoExtraido,
  a: Auditoria | null,
): Requisito {
  return {
    ...t,
    val: "propuesto",
    estado: "pendiente",
    obs: "",
    evidencias: [],
    hist: [
      {
        f: nowISO(),
        a: `Requisito generado desde ${docById(t.fuente.doc, a).numero}`,
        q: "Sistema",
      },
    ],
  };
}

interface DemoOpts {
  seq: number;
  nombre: string;
  fecha: string;
  publicada: string;
  cerrada?: string;
  set: Record<string, EstadoTerreno>;
  obs: Record<string, string>;
  quien: string;
}

function demoAudit(o: DemoOpts): Auditoria {
  const a = newAudit(o.seq, {
    inst: "aucha",
    nombre: o.nombre,
    tipo: "Interna",
    fecha: o.fecha,
  });
  a.perts.forEach((p) => (p.cargada = true));
  a.validador = "Encargada de Cumplimiento Normativo";
  a.generado = true;
  a.step = 4;
  a.reqs = REQ_TEMPLATES.map((t) => ({
    ...t,
    val: "validado",
    estado: "pendiente",
    obs: "",
    evidencias: [],
    hist: [
      {
        f: `${o.fecha}T10:00:00Z`,
        a: `Requisito generado desde ${docById(t.fuente.doc).numero}`,
        q: "Sistema",
      },
      {
        f: `${o.publicada}T15:30:00Z`,
        a: "Validado para la auditoría",
        q: a.validador,
      },
    ],
  }));
  a.reqs.forEach((r) => {
    const e = o.set[r.id];
    if (!e) return;
    r.estado = e;
    r.obs =
      o.obs[r.id] ??
      (e === "no_cumple"
        ? "Hallazgo registrado en terreno; ver evidencia."
        : "");
    if (e === "na") r.naMotivo = NA_MOTIVOS[0];
    r.evidencias = [
      {
        nombre: `evidencia_${r.id.toLowerCase()}.jpg`,
        fecha: o.publicada,
        sync: true,
      },
    ];
    r.hist.push({
      f: `${o.publicada}T18:00:00Z`,
      a: `Marcado como “${ESTADOS[e]}” con 1 evidencia`,
      q: o.quien,
    });
  });
  a.status = o.cerrada ? "cerrada" : "publicada";
  a.publicada = o.publicada;
  a.cerrada = o.cerrada ?? null;
  return a;
}

/** Ejemplo para presentar: Aucha con una auditoría cerrada (Q3) y otra en terreno (Q4). */
export function demoAudits(): Auditoria[] {
  const q3set: Record<string, EstadoTerreno> = {};
  REQ_TEMPLATES.forEach((t, i) => {
    q3set[t.id] =
      i % 9 === 4 || i % 13 === 3
        ? "no_cumple"
        : i % 11 === 10
          ? "na"
          : "cumple";
  });
  const q3 = demoAudit({
    seq: 1,
    nombre: "Auditoría interna Q3 2026",
    fecha: "2026-07-08",
    publicada: "2026-07-10",
    cerrada: "2026-07-24",
    set: q3set,
    obs: {
      R06: "Bitácora diaria incompleta en junio.",
      R13: "Ducha lavaojos sin señalética.",
      R22: "Capacitación agendada para agosto.",
    },
    quien: "Jefe de piscicultura",
  });
  const q4 = demoAudit({
    seq: 2,
    nombre: "Auditoría interna Q4 2026",
    fecha: "2026-10-14",
    publicada: "2026-10-15",
    quien: "Jefe de piscicultura",
    set: {
      R01: "cumple",
      R02: "no_cumple",
      R03: "cumple",
      R05: "cumple",
      R06: "cumple",
      R09: "cumple",
      R10: "cumple",
      R11: "cumple",
      R12: "no_cumple",
      R13: "cumple",
      R16: "cumple",
      R20: "no_cumple",
      R21: "cumple",
      R27: "cumple",
      R28: "no_cumple",
      R30: "cumple",
      R35: "na",
    },
    obs: {
      R02: "Grupos de 635 y 750 kVA con silenciador nuevo; falta el de 50 kVA en L2.",
      R12: "Faltan registros de pH de 3 días de la semana pasada.",
      R20: "Limpieza realizada, pero falta la guía de despacho de septiembre.",
      R28: "Envases de aerosol con fecha de ingreso de marzo 2026 (más de 6 meses).",
    },
  });
  return [q3, q4];
}
