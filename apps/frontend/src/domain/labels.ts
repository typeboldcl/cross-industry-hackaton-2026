import type {
  AuditKind,
  AuditResult,
  AuditStatus,
  DocumentKind,
  FacilityKind,
  NaReason,
  ObligationStatus,
} from "@hackaton/contracts";

/**
 * Etiquetas en español para los valores del backend. La API usa claves en
 * inglés; la interfaz siempre muestra estas.
 */

/** Igual que la planilla actual de Invermar: SÍ / NO / N/A. */
export const RESULT_LABEL: Record<AuditResult, string> = {
  compliant: "Cumple",
  non_compliant: "No cumple",
  not_applicable: "No aplica",
  pending: "Pendiente",
};

/** Etiqueta corta para los botones de la lista de terreno. */
export const RESULT_SHORT: Record<AuditResult, string> = {
  ...RESULT_LABEL,
  not_applicable: "N/A",
};

/** Resultados que se pueden marcar en terreno, en el orden de los botones. */
export const MARKABLE = [
  "compliant",
  "non_compliant",
  "not_applicable",
] as const;
export type MarkableResult = (typeof MARKABLE)[number];

/** Clase CSS del semáforo (los estilos vienen del prototipo). */
export const RESULT_CSS: Record<AuditResult, string> = {
  compliant: "cumple",
  non_compliant: "no_cumple",
  not_applicable: "na",
  pending: "pendiente",
};

/** "No aplica" siempre lleva motivo: sin él no se distingue de uno que se saltó. */
export const NA_REASON_LABEL: Record<NaReason, string> = {
  activity_not_performed: "La actividad no se realiza en el centro",
  not_current_phase: "No corresponde a la fase actual del proyecto",
  outside_period: "Su plazo o frecuencia no cae en este periodo",
  other: "Otro motivo",
};
export const NA_REASONS = Object.keys(NA_REASON_LABEL) as NaReason[];

export const AUDIT_STATUS: Record<
  AuditStatus,
  { label: string; cls: string; action: string; route: AuditView }
> = {
  draft: {
    label: "Borrador",
    cls: "",
    action: "Continuar preparación",
    route: "preparar",
  },
  in_validation: {
    label: "En validación",
    cls: "warn",
    action: "Validar requisitos",
    route: "preparar",
  },
  published: {
    label: "En terreno",
    cls: "info",
    action: "Continuar en terreno",
    route: "terreno",
  },
  closed: {
    label: "Cerrada",
    cls: "ok",
    action: "Ver resultados",
    route: "panel",
  },
};
export type AuditView = "preparar" | "terreno" | "panel";

export const AUDIT_KIND_LABEL: Record<AuditKind, string> = {
  interna: "Interna",
  seguimiento: "Seguimiento de hallazgos",
  externa: "Externa / certificación",
  simulacro_sma: "Simulacro de fiscalización SMA",
};

export const FACILITY_KIND_LABEL: Record<FacilityKind, string> = {
  piscicultura: "Piscicultura",
  centro_cultivo: "Centro de cultivo (CES)",
  planta: "Planta",
};

export const FACILITY_ICON: Record<FacilityKind, "fish" | "boat" | "factory"> =
  {
    piscicultura: "fish",
    centro_cultivo: "boat",
    planta: "factory",
  };

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  rca: "RCA",
  rectificacion: "Rectificación",
  pertinencia: "Pertinencia",
  res_sanitaria: "Res. sanitaria",
  norma: "Norma",
  otro: "Documento",
};

export const OBLIGATION_STATUS_LABEL: Record<ObligationStatus, string> = {
  draft: "Propuesto",
  validated: "Validado",
  rejected: "Descartado",
  superseded: "Reemplazado",
  revoked: "Derogado",
};

export const FREQUENCIES = [
  "Diaria",
  "Semanal",
  "Mensual",
  "Trimestral",
  "Semestral",
  "Anual",
  "Por evento",
  "Verificación única",
];
