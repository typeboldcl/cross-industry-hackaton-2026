import type { AuditDetail, ObligationListItem } from "@hackaton/contracts";
import { useOutletContext } from "react-router";

export interface AuditCtx {
  audit: AuditDetail;
  /** Requisitos de la instalación: dan la temática de cada ítem. */
  obligations: ObligationListItem[];
}

/** Auditoría abierta, para las pantallas dentro de /auditorias/:auditId. */
export const useAuditCtx = () => useOutletContext<AuditCtx>();
