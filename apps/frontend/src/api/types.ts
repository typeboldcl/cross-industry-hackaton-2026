import type { Auditoria, EstadoTerreno } from "@hackaton/contracts";

/** Revierte un cambio hecho en terreno (botón "Deshacer"). */
export type Undo = () => Promise<void>;

export interface NuevaAuditoria {
  inst: string;
  nombre: string;
  tipo: string;
  fecha: string;
}

export interface NuevoRequisito {
  tema: string;
  titulo: string;
  detalle: string;
  /** Id del documento fuente o "MANUAL". */
  doc: string;
  ref: string;
  frecuencia: string;
  venc: string;
  evidencia: string;
}

export interface Evaluacion {
  estado: EstadoTerreno;
  obs?: string;
  naMotivo?: string;
}

/**
 * Operaciones que el frontend pide al backend, agrupadas como los endpoints
 * de la API. Las pantallas solo usan esto (vía `api`), nunca el store.
 *
 * Hoy la implementa `localApi` sobre los datos guardados en el teléfono. Cuando
 * el backend esté listo se agrega `httpApi` con los mismos métodos y las
 * pantallas no cambian. Los nombres de campos siguen el modelo actual del
 * front; se ajustarán al modelo del MVP cuando Adriel lo apruebe.
 */
export interface AuditApi {
  audits: {
    create(input: NuevaAuditoria): Promise<Auditoria>;
    /** Paso del asistente de preparación (estado de pantalla, hoy guardado en la auditoría). */
    setStep(auditId: string, step: number): Promise<void>;
    toggleCategory(auditId: string, tema: string): Promise<void>;
    publish(auditId: string, validador: string): Promise<void>;
    close(auditId: string): Promise<void>;
  };
  documents: {
    upload(auditId: string, file: File): Promise<void>;
    loadPertinencia(auditId: string, pertId: string): Promise<void>;
    uploadPertinencia(auditId: string, file: File): Promise<void>;
  };
  obligations: {
    /** Genera los requisitos propuestos a partir de los documentos (LLM). */
    generate(auditId: string): Promise<void>;
    create(auditId: string, input: NuevoRequisito): Promise<string>;
    edit(
      auditId: string,
      reqId: string,
      titulo: string,
      detalle: string,
    ): Promise<void>;
    discard(auditId: string, reqId: string): Promise<void>;
    restore(auditId: string, reqId: string): Promise<void>;
  };
  items: {
    /** Resultado en terreno; devuelve cómo deshacerlo. */
    assess(auditId: string, reqId: string, ev: Evaluacion): Promise<Undo>;
    /** Marca como No aplica todos los pendientes de una temática. */
    categoryNotApplicable(
      auditId: string,
      tema: string,
    ): Promise<{ count: number; undo: Undo }>;
    setNotes(auditId: string, reqId: string, obs: string): Promise<void>;
    setNaReason(auditId: string, reqId: string, motivo: string): Promise<void>;
  };
  evidence: {
    upload(auditId: string, reqId: string, file: File): Promise<void>;
    remove(auditId: string, reqId: string, index: number): Promise<void>;
  };
  /** Solo para presentar el prototipo. */
  demo: {
    load(): Promise<void>;
    reset(): Promise<void>;
  };
}
