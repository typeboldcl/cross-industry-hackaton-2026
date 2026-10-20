export type FacilityKind = "centro_cultivo" | "piscicultura" | "planta";

export interface Facility {
  id: string;
  titular: string;
  kind: FacilityKind;
  name: string;
  comuna: string;
  location: string | null;
  externalCodes: Record<string, string>;
  createdAt: string;
}

export interface FacilityListItem extends Facility {
  summary: { score: number | null; audits: number; openAudits: number };
}

export interface Authority {
  id: string;
  code: string;
  name: string;
}

export interface CreateFacilityRequest {
  titular: string;
  kind: FacilityKind;
  name: string;
  comuna: string;
  location?: string | null;
  externalCodes?: Record<string, string>;
}
