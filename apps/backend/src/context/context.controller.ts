import type { FacilityContext } from "@hackaton/contracts";
import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { ContextService } from "./context.service.js";

@Controller()
export class ContextController {
  constructor(private readonly context: ContextService) {}

  @Get("facilities/:facilityId/context")
  get(
    @Param("facilityId", ParseUUIDPipe) facilityId: string,
  ): Promise<FacilityContext> {
    return this.context.get(facilityId);
  }
}
