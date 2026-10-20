import { AuditItemEntity } from "../../audits/entities/audit-item.entity.js";
import { AuditEntity } from "../../audits/entities/audit.entity.js";
import { EvidenceEntity } from "../../audits/entities/evidence.entity.js";
import { AuthorityEntity } from "../../catalog/entities/authority.entity.js";
import { FacilityEntity } from "../../catalog/entities/facility.entity.js";
import { DocumentChunkEntity } from "../../documents/entities/document-chunk.entity.js";
import { DocumentEntity } from "../../documents/entities/document.entity.js";
import { ExtractionRunEntity } from "../../llm/entities/extraction-run.entity.js";
import { ObligationSourceEntity } from "../../obligations/entities/obligation-source.entity.js";
import { ObligationVersionEntity } from "../../obligations/entities/obligation-version.entity.js";
import { ObligationEntity } from "../../obligations/entities/obligation.entity.js";

export const ENTITIES = [
  FacilityEntity,
  AuthorityEntity,
  DocumentEntity,
  DocumentChunkEntity,
  ExtractionRunEntity,
  ObligationEntity,
  ObligationVersionEntity,
  ObligationSourceEntity,
  AuditEntity,
  AuditItemEntity,
  EvidenceEntity,
];
