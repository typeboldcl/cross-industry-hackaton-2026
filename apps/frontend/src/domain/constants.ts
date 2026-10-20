import type { EstadoAuditoria, EstadoTerreno } from "@hackaton/contracts";

/** Igual que la planilla actual de Invermar: SÍ / NO / N/A (sin "parcial"). */
export const ESTADOS: Record<EstadoTerreno, string> = {
  cumple: "Cumple",
  no_cumple: "No cumple",
  na: "No aplica",
  pendiente: "Pendiente",
};

/** Estados que se pueden marcar en terreno, en el orden de los botones. */
export const MARCABLES = ["cumple", "no_cumple", "na"] as const;
export type EstadoMarcable = (typeof MARCABLES)[number];

/** "No aplica" siempre lleva motivo: sin él, un N/A no se distingue de un requisito que se saltó. */
export const NA_MOTIVOS = [
  "La actividad no se realiza en el centro",
  "No corresponde a la fase actual del proyecto",
  "Su plazo o frecuencia no cae en este periodo",
  "Otro motivo",
] as const;
export const NA_OTRO = "Otro motivo";

export const TIPOS_AUDITORIA = [
  "Interna",
  "Seguimiento de hallazgos",
  "Externa / certificación",
  "Simulacro de fiscalización SMA",
];

export const FRECUENCIAS = [
  "Diaria",
  "Semanal",
  "Mensual",
  "Trimestral",
  "Semestral",
  "Anual",
  "Por evento",
  "Verificación única",
];

export type VistaAuditoria = "preparar" | "terreno" | "panel";

export const STATUS: Record<
  EstadoAuditoria,
  { label: string; cls: string; accion: string; ruta: VistaAuditoria }
> = {
  sin_preparar: {
    label: "Borrador",
    cls: "",
    accion: "Continuar preparación",
    ruta: "preparar",
  },
  en_validacion: {
    label: "En validación",
    cls: "warn",
    accion: "Validar requisitos",
    ruta: "preparar",
  },
  publicada: {
    label: "En terreno",
    cls: "info",
    accion: "Continuar en terreno",
    ruta: "terreno",
  },
  cerrada: {
    label: "Cerrada",
    cls: "ok",
    accion: "Ver resultados",
    ruta: "panel",
  },
};

export const INST_ICON: Record<string, "fish" | "boat" | "factory"> = {
  aucha: "fish",
  ces: "boat",
  planta: "factory",
};
