import type {
  DocumentDetail,
  DocumentSummary,
  ExtractionProgress,
} from "@hackaton/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { DocumentsService, type UploadedPdf } from "./documents.service.js";
import { UploadDocumentDto } from "./upload-document.dto.js";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post("facilities/:facilityId/documents")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  async upload(
    @Param("facilityId", ParseUUIDPipe) facilityId: string,
    @UploadedFile() file: UploadedPdf | undefined,
    @Body() body: UploadDocumentDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DocumentDetail> {
    if (!file) {
      throw new BadRequestException("Adjunta el PDF en el campo «file».");
    }

    const { document, created } = await this.documents.upload(
      facilityId,
      file,
      body.kind,
      body.title,
    );
    response.status(created ? 201 : 200);
    return document;
  }

  @Get("facilities/:facilityId/documents")
  list(
    @Param("facilityId", ParseUUIDPipe) facilityId: string,
  ): Promise<DocumentSummary[]> {
    return this.documents.list(facilityId);
  }

  @Get("documents/:id")
  detail(@Param("id", ParseUUIDPipe) id: string): Promise<DocumentDetail> {
    return this.documents.detail(id);
  }

  @Get("documents/:id/file")
  async file(
    @Param("id", ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    response.redirect(302, await this.documents.fileUrl(id));
  }

  @Get("documents/:id/extraction")
  progress(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ExtractionProgress> {
    return this.documents.progress(id);
  }

  @Post("documents/:id/extraction")
  @HttpCode(202)
  reprocess(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ExtractionProgress> {
    return this.documents.reprocess(id);
  }
}
