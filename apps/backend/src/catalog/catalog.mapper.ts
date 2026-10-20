import type { Authority, Facility } from "@hackaton/contracts";
import type { AuthorityEntity } from "./entities/authority.entity.js";
import type { FacilityEntity } from "./entities/facility.entity.js";

export function toAuthority(entity: AuthorityEntity): Authority {
  return { id: entity.id, code: entity.code, name: entity.name };
}

export function toFacility(entity: FacilityEntity): Facility {
  return {
    id: entity.id,
    titular: entity.titular,
    kind: entity.kind,
    name: entity.name,
    comuna: entity.comuna,
    externalCodes: entity.externalCodes,
    createdAt: entity.createdAt.toISOString(),
  };
}
