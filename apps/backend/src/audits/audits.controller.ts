import type {
  AuditDetail,
  AuditItem,
  AuditSummary,
  Evidence,
} from "@hackaton/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { ActorName } from "../common/http/actor-name.decorator.js";
import {
  AddAuditItemDto,
  AssessItemDto,
  CreateAuditDto,
  UploadEvidenceDto,
} from "./audits.dto.js";
import {
  AuditsService,
  type UploadedFile as Upload,
} from "./audits.service.js";

const MAX_EVIDENCE_BYTES = 50 * 1024 * 1024;

@Controller()
export class AuditsController {
  constructor(private readonly audits: AuditsService) {}

  @Post("audits")
  create(@Body() body: CreateAuditDto): Promise<AuditDetail> {
    return this.audits.create(body);
  }

  @Get("facilities/:facilityId/audits")
  list(
    @Param("facilityId", ParseUUIDPipe) facilityId: string,
  ): Promise<AuditSummary[]> {
    return this.audits.list(facilityId);
  }

  @Get("audits/:id")
  detail(@Param("id", ParseUUIDPipe) id: string): Promise<AuditDetail> {
    return this.audits.detail(id);
  }

  @Post("audits/:id/items")
  addItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AddAuditItemDto,
  ): Promise<AuditItem> {
    return this.audits.addItem(id, body.obligationVersionId);
  }

  @Delete("audits/:id/items/:itemId")
  @HttpCode(204)
  removeItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    return this.audits.removeItem(id, itemId);
  }

  @Patch("audit-items/:id")
  assess(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AssessItemDto,
    @ActorName() actor: string,
  ): Promise<AuditItem> {
    return this.audits.assess(id, body, actor);
  }

  @Post("audits/:id/close")
  @HttpCode(200)
  close(@Param("id", ParseUUIDPipe) id: string): Promise<AuditDetail> {
    return this.audits.close(id);
  }

  @Post("audit-items/:id/evidence")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_EVIDENCE_BYTES } }),
  )
  async uploadEvidence(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Upload | undefined,
    @Body() body: UploadEvidenceDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Evidence> {
    const replay = await this.audits.findEvidenceByClientId(body.clientId);
    if (replay) {
      response.status(200);
      return replay;
    }
    if (!file) {
      throw new BadRequestException("Adjunta la evidencia en el campo «file».");
    }
    return this.audits.uploadEvidence(id, file, body.clientId, body.capturedAt);
  }

  @Get("evidence/:id/file")
  async evidenceFile(
    @Param("id", ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    response.redirect(302, await this.audits.evidenceUrl(id));
  }
}
