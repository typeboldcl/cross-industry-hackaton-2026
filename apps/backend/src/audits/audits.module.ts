import { Module } from "@nestjs/common";
import { ObligationsModule } from "../obligations/obligations.module.js";
import { AuditsController } from "./audits.controller.js";
import { AuditsService } from "./audits.service.js";

@Module({
  imports: [ObligationsModule],
  controllers: [AuditsController],
  providers: [AuditsService],
  exports: [AuditsService],
})
export class AuditsModule {}
