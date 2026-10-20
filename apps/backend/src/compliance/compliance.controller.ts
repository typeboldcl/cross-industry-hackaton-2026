import type { FacilityCompliance } from "@hackaton/contracts";
import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { ComplianceService } from "./compliance.service.js";

@Controller()
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get("facilities/:facilityId/compliance")
  summary(
    @Param("facilityId", ParseUUIDPipe) facilityId: string,
  ): Promise<FacilityCompliance> {
    return this.compliance.summary(facilityId);
  }
}
