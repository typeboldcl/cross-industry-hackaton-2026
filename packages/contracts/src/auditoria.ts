/**
 * Tipos del dominio de auditorías por instalación.
 *
 * `RequisitoExtraido` es el contrato del módulo de extracción con LLM: lo que
 * debe devolver al leer la RCA, sus rectificaciones y las resoluciones
 * sectoriales de un centro. El resto describe cómo el frontend guarda una
 * auditoría y el resultado en terreno.
 */

/** Resultado en terreno, igual que la planilla actual: SÍ / NO / N/A. */
export type EstadoTerreno = "pendiente" | "cumple" | "no_cumple" | "na";

/** Revisión del responsable antes de publicar la auditoría. */
export type Validacion = "propuesto" | "validado" | "descartado" | "fuera";

export type EstadoAuditoria =
  "sin_preparar" | "en_validacion" | "publicada" | "cerrada";

export interface FuenteRequisito {
  /** Id del documento del centro (o "MANUAL" si no viene de un documento). */
  doc: string;
  /** Considerando, tabla o resuelvo donde aparece la obligación. */
  ref: string;
}

/** Lo que devuelve la extracción con LLM por cada obligación encontrada. */
export interface RequisitoExtraido {
  id: string;
  tema: string;
  titulo: string;
  detalle: string;
  fuente: FuenteRequisito;
  frecuencia: string;
  evidencia: string;
  /** Próximo vencimiento, AAAA-MM-DD. */
  venc?: string;
  /** Qué cambió si una rectificación modificó la obligación. */
  rectificado?: string;
}

export interface Evidencia {
  nombre: string;
  /** AAAA-MM-DD */
  fecha: string;
  /** Miniatura en data URL (solo fotos). */
  thumb?: string | null;
  sync: boolean;
}

export interface EventoHistorial {
  /** Fecha ISO. */
  f: string;
  /** Qué pasó. */
  a: string;
  /** Quién lo hizo. */
  q: string;
}

export interface Requisito extends RequisitoExtraido {
  val: Validacion;
  estado: EstadoTerreno;
  obs: string;
  naMotivo?: string;
  evidencias: Evidencia[];
  hist: EventoHistorial[];
  manual?: boolean;
  editado?: boolean;
}

export type EstadoDocumento = "ok" | "warn" | "info";

export interface Documento {
  id: string;
  tipo: string;
  numero: string;
  fecha?: string;
  emisor?: string;
  titulo: string;
  vigencia?: string;
  estado?: EstadoDocumento;
}

export interface Pertinencia {
  id: string;
  numero: string;
  titulo: string;
  cargada: boolean;
}

export interface Instalacion {
  id: string;
  nombre: string;
  tipo: string;
  lugar: string;
  /** Tiene documentos reales del reto. */
  real: boolean;
  /** Números ficticios para centros sin auditorías. */
  demo?: { pct: number; avance: number; nc: number; total: number };
}

export interface Auditoria {
  id: string;
  inst: string;
  nombre: string;
  tipo: string;
  /** Fecha programada, AAAA-MM-DD. */
  fecha: string;
  creada: string;
  /** Paso actual del asistente de preparación (1 a 4). */
  step: number;
  docs: Documento[];
  perts: Pertinencia[];
  extras: Documento[];
  status: EstadoAuditoria;
  generado: boolean;
  validador: string;
  publicada: string | null;
  cerrada: string | null;
  reqs: Requisito[];
  /** Temáticas excluidas al validar. */
  temasOff: string[];
}
