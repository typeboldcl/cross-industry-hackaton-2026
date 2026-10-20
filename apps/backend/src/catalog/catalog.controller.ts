import type { Authority, Facility } from "@hackaton/contracts";
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { toAuthority, toFacility } from "./catalog.mapper.js";
import { AuthorityEntity } from "./entities/authority.entity.js";
import { FacilityEntity } from "./entities/facility.entity.js";

@Controller()
export class CatalogController {
  constructor(
    @InjectRepository(FacilityEntity)
    private readonly facilities: Repository<FacilityEntity>,
    @InjectRepository(AuthorityEntity)
    private readonly authorities: Repository<AuthorityEntity>,
  ) {}

  @Get("facilities")
  async listFacilities(): Promise<Facility[]> {
    const rows = await this.facilities.find({ order: { name: "ASC" } });
    return rows.map(toFacility);
  }

  @Get("facilities/:facilityId")
  async getFacility(
    @Param("facilityId", ParseUUIDPipe) facilityId: string,
  ): Promise<Facility> {
    const facility = await this.facilities.findOneBy({ id: facilityId });
    if (!facility) throw new NotFoundException("Instalación no encontrada.");
    return toFacility(facility);
  }

  @Get("authorities")
  async listAuthorities(): Promise<Authority[]> {
    const rows = await this.authorities.find({ order: { code: "ASC" } });
    return rows.map(toAuthority);
  }
}
