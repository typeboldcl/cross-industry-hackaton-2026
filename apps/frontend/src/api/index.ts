import type { Auditoria } from "@hackaton/contracts";
import { useAuditStore } from "../store/useAuditStore";
import { toast } from "../store/useUiStore";
import { localApi } from "./localApi";
import type { AuditApi } from "./types";

export type * from "./types";

/**
 * Punto único de acceso a los datos para las pantallas. Para conectar el
 * backend real basta con cambiar esta línea por una implementación HTTP.
 */
export const api: AuditApi = localApi;

/**
 * Ejecuta una llamada a la API desde un evento de la interfaz. Si falla, avisa
 * al usuario y devuelve `undefined` en vez de dejar la promesa sin manejar.
 */
export async function run<T>(call: Promise<T>): Promise<T | undefined> {
  try {
    return await call;
  } catch (err) {
    console.error(err);
    toast("No se pudo guardar el cambio. Intenta de nuevo.");
    return undefined;
  }
}

/** Como `run`, pero solo dice si funcionó (para operaciones sin respuesta). */
export async function attempt(call: Promise<unknown>): Promise<boolean> {
  try {
    await call;
    return true;
  } catch (err) {
    console.error(err);
    toast("No se pudo guardar el cambio. Intenta de nuevo.");
    return false;
  }
}

// Lecturas: la caché local (los datos que ya devolvió la API o que se
// crearon sin conexión). Se actualizan solas cuando cambia algo.

/** Todas las auditorías conocidas en este dispositivo. */
export const useAudits = (): Auditoria[] => useAuditStore((s) => s.audits);

/** Auditoría por id (o null). */
export const useAudit = (auditId: string | undefined): Auditoria | null =>
  useAuditStore((s) => s.audits.find((a) => a.id === auditId) ?? null);
