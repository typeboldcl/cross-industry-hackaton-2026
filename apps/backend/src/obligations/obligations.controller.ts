import type {
  ObligationDetail,
  ObligationListItem,
  ObligationVersion,
} from "@hackaton/contracts";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ActorName } from "../common/http/actor-name.decorator.js";
import {
  ListObligationsQuery,
  UpdateDraftDto,
  UpdateObligationDto,
} from "./obligations.dto.js";
import { ObligationsService } from "./obligations.service.js";

@Controller()
export class ObligationsController {
  constructor(private readonly obligations: ObligationsService) {}

  @Get("facilities/:facilityId/obligations")
  list(
    @Param("facilityId", ParseUUIDPipe) facilityId: string,
    @Query() query: ListObligationsQuery,
  ): Promise<ObligationListItem[]> {
    return this.obligations.list(facilityId, query);
  }

  @Get("obligations/:id")
  detail(@Param("id", ParseUUIDPipe) id: string): Promise<ObligationDetail> {
    return this.obligations.detail(id);
  }

  @Patch("obligations/:id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateObligationDto,
  ): Promise<ObligationDetail> {
    return this.obligations.update(id, body);
  }

  @Patch("obligation-versions/:id")
  updateDraft(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateDraftDto,
  ): Promise<ObligationVersion> {
    return this.obligations.updateDraft(id, body);
  }

  @Post("obligation-versions/:id/validate")
  @HttpCode(200)
  validate(
    @Param("id", ParseUUIDPipe) id: string,
    @ActorName() actor: string,
  ): Promise<ObligationVersion> {
    return this.obligations.validate(id, actor);
  }

  @Post("obligation-versions/:id/restore")
  @HttpCode(200)
  restore(
    @Param("id", ParseUUIDPipe) id: string,
    @ActorName() _actor: string,
  ): Promise<ObligationVersion> {
    return this.obligations.restore(id);
  }

  @Post("obligation-versions/:id/reject")
  @HttpCode(200)
  reject(
    @Param("id", ParseUUIDPipe) id: string,
    @ActorName() _actor: string,
  ): Promise<ObligationVersion> {
    return this.obligations.reject(id);
  }
}
