import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditsModule } from "../audits/audits.module.js";
import { FacilityEntity } from "../catalog/entities/facility.entity.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { DocumentEntity } from "../documents/entities/document.entity.js";
import { SeiaModule } from "../seia/seia.module.js";
import { ContextController } from "./context.controller.js";
import { ContextService } from "./context.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([FacilityEntity, DocumentEntity]),
    DocumentsModule,
    AuditsModule,
    SeiaModule,
  ],
  controllers: [ContextController],
  providers: [ContextService],
})
export class ContextModule {}
