import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthorityEntity } from "../catalog/entities/authority.entity.js";
import { FacilityEntity } from "../catalog/entities/facility.entity.js";
import { ProcessingModule } from "../processing/processing.module.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsService } from "./documents.service.js";
import { DocumentEntity } from "./entities/document.entity.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, FacilityEntity, AuthorityEntity]),
    ProcessingModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
