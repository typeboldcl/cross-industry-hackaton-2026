import type {
  AuditItem,
  AuditKind,
  AuditStatus,
  Authority,
  Evidence,
  Facility,
  FacilityAlert,
  FacilityDocument,
  FacilityPertinencia,
  ObligationOrigin,
  ObligationVersion,
} from "@hackaton/contracts";

/**
 * "Base de datos" del modo demo: las mismas tablas del backend (simplificadas),
 * guardadas en el navegador. `demoApi` arma con ellas las respuestas de la API.
 */
export interface DemoDb {
  authorities: Authority[];
  facilities: Facility[];
  documents: FacilityDocument[];
  pertinencias: (FacilityPertinencia & { facilityId: string })[];
  alerts: (FacilityAlert & { facilityId: string })[];
  obligations: DemoObligation[];
  versions: ObligationVersion[];
  audits: DemoAudit[];
  items: DemoItem[];
  evidence: Evidence[];
}

export interface DemoObligation {
  id: string;
  facilityId: string;
  authorityId: string;
  key: string;
  origin: ObligationOrigin;
  category: string;
  createdAt: string;
}

export interface DemoAudit {
  id: string;
  facilityId: string;
  authorityId: string | null;
  title: string;
  kind: AuditKind;
  periodFrom: string | null;
  periodTo: string | null;
  plannedOn: string;
  status: AuditStatus;
  createdByName: string | null;
  validatedByName: string | null;
  excludedCategories: string[];
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
  clientId: string | null;
}

export type DemoItem = Omit<AuditItem, "version" | "evidence"> & {
  versionId: string;
};

const KEY = "auditorias-demo-v1";

export function loadDb(): DemoDb | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DemoDb) : null;
  } catch {
    return null;
  }
}

export function saveDb(db: DemoDb): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Sin espacio o modo privado: los cambios duran solo esta sesión.
  }
}
