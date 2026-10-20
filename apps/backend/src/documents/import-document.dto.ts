import type { DocumentKind, ImportDocumentRequest } from "@hackaton/contracts";
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";
import { DOCUMENT_KINDS } from "./upload-document.dto.js";

export class ImportDocumentDto implements ImportDocumentRequest {
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2000)
  url: string;

  @IsIn(DOCUMENT_KINDS)
  kind: DocumentKind;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;
}
