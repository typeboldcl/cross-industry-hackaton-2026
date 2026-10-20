import type { DocumentKind } from "@hackaton/contracts";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const DOCUMENT_KINDS: DocumentKind[] = [
  "rca",
  "rectificacion",
  "pertinencia",
  "res_sanitaria",
  "norma",
  "otro",
];

export class UploadDocumentDto {
  @IsIn(DOCUMENT_KINDS)
  kind: DocumentKind;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;
}
