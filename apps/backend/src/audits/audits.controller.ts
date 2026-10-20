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
import {
  ActorName,
  OptionalActorName,
} from "../common/http/actor-name.decorator.js";
import {
  AddAuditItemDto,
  AddManualRequirementDto,
  AssessItemDto,
  CategoryNotApplicableDto,
  CreateAuditDto,
  PublishAuditDto,
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
  create(
    @Body() body: CreateAuditDto,
    @OptionalActorName() actor: string | null,
  ): Promise<AuditDetail> {
    return this.audits.create(body, actor);
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

  @Post("audits/:id/generate")
  @HttpCode(200)
  generate(@Param("id", ParseUUIDPipe) id: string): Promise<AuditDetail> {
    return this.audits.generate(id);
  }

  @Post("audits/:id/publish")
  @HttpCode(200)
  publish(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: PublishAuditDto,
    @ActorName() actor: string,
  ): Promise<AuditDetail> {
    return this.audits.publish(id, body.excludedCategories, actor);
  }

  @Post("audits/:id/items")
  addItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AddAuditItemDto,
  ): Promise<AuditItem> {
    return this.audits.addItem(id, body.obligationVersionId);
  }

  @Post("audits/:id/manual-requirements")
  addManualRequirement(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AddManualRequirementDto,
    @ActorName() actor: string,
  ): Promise<AuditItem> {
    return this.audits.addManualRequirement(id, body, actor);
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

  @Post("audits/:id/categories/:category/not-applicable")
  @HttpCode(200)
  markCategoryNotApplicable(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("category") category: string,
    @Body() body: CategoryNotApplicableDto,
    @ActorName() actor: string,
  ): Promise<AuditItem[]> {
    return this.audits.markCategoryNotApplicable(
      id,
      category,
      body.naReason,
      body.notes ?? null,
      actor,
    );
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
    @OptionalActorName() actor: string | null,
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
    return this.audits.uploadEvidence(
      id,
      file,
      body.clientId,
      body.capturedAt,
      actor,
    );
  }

  @Delete("evidence/:id")
  @HttpCode(204)
  deleteEvidence(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.audits.deleteEvidence(id);
  }

  @Get("evidence/:id/file")
  async evidenceFile(
    @Param("id", ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    response.redirect(302, await this.audits.evidenceUrl(id));
  }
}
