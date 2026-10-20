export type FacilityKind = "centro_cultivo" | "piscicultura" | "planta";

export interface Facility {
  id: string;
  titular: string;
  kind: FacilityKind;
  name: string;
  comuna: string;
  externalCodes: Record<string, string>;
  createdAt: string;
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
  externalCodes?: Record<string, string>;
}
