import type { AuditKind, AuditResult, NaReason } from "@hackaton/contracts";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

const RESULTS: AuditResult[] = [
  "compliant",
  "non_compliant",
  "not_applicable",
  "pending",
];

export const AUDIT_KINDS: AuditKind[] = [
  "interna",
  "seguimiento",
  "externa",
  "simulacro_sma",
];

export const NA_REASONS: NaReason[] = [
  "activity_not_performed",
  "not_current_phase",
  "outside_period",
  "other",
];

export class CreateAuditDto {
  @IsUUID()
  facilityId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsIn(AUDIT_KINDS)
  kind: AuditKind;

  @IsISO8601({ strict: true })
  plannedOn: string;

  @IsOptional()
  @IsUUID()
  authorityId?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  periodFrom?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  periodTo?: string | null;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}

export class PublishAuditDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  excludedCategories: string[];
}

export class AddAuditItemDto {
  @IsUUID()
  obligationVersionId: string;
}

export class AddManualRequirementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  category: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  body: string;

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
  @IsUUID()
  authorityId?: string | null;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}

export class AssessItemDto {
  @IsIn(RESULTS)
  result: AuditResult;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  notes?: string | null;

  @IsOptional()
  @IsIn(NA_REASONS)
  naReason?: NaReason | null;
}

export class CategoryNotApplicableDto {
  @IsIn(NA_REASONS)
  naReason: NaReason;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  notes?: string | null;
}

export class UploadEvidenceDto {
  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsISO8601()
  capturedAt?: string;
}
