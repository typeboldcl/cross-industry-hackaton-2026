import type { Auditoria } from "@hackaton/contracts";
import { useOutletContext } from "react-router";

export interface AuditCtx {
  audit: Auditoria;
}

/** Auditoría abierta, para las pantallas dentro de /auditorias/:auditId. */
export const useAuditCtx = () => useOutletContext<AuditCtx>().audit;
