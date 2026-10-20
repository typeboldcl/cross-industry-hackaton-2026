import type { ObligationStatus, Phase } from "@hackaton/contracts";
import {
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

const PHASES: Phase[] = ["construccion", "operacion", "cierre"];
const STATUSES: ObligationStatus[] = [
  "draft",
  "validated",
  "superseded",
  "revoked",
  "rejected",
];

export class ListObligationsQuery {
  @IsOptional()
  @IsIn(STATUSES)
  status?: ObligationStatus;

  @IsOptional()
  @IsUUID()
  authorityId?: string;

  @IsOptional()
  @IsUUID()
  documentId?: string;
}

export class UpdateObligationDto {
  @IsOptional()
  @IsUUID()
  authorityId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  category?: string;
}

export class UpdateDraftDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @IsOptional()
  @IsIn([...PHASES, null])
  phase?: Phase | null;

  @IsOptional()
  @IsString()
  frequency?: string | null;

  @IsOptional()
  @IsString()
  expectedEvidence?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueDate?: string | null;

  @IsOptional()
  @IsObject()
  dueRule?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}
