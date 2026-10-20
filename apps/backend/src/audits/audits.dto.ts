import type { AuditResult } from "@hackaton/contracts";
import {
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

export class CreateAuditDto {
  @IsUUID()
  facilityId: string;

  @IsUUID()
  authorityId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  kind: string;

  @IsISO8601({ strict: true })
  periodFrom: string;

  @IsISO8601({ strict: true })
  periodTo: string;

  @IsISO8601({ strict: true })
  plannedOn: string;
}

export class AddAuditItemDto {
  @IsUUID()
  obligationVersionId: string;
}

export class AssessItemDto {
  @IsIn(RESULTS)
  result: AuditResult;

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
