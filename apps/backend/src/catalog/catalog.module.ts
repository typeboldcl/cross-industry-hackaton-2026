import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CatalogController } from "./catalog.controller.js";
import { AuthorityEntity } from "./entities/authority.entity.js";
import { FacilityEntity } from "./entities/facility.entity.js";

@Module({
  imports: [TypeOrmModule.forFeature([FacilityEntity, AuthorityEntity])],
  controllers: [CatalogController],
})
export class CatalogModule {}
