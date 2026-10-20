import type {
  Authority,
  Facility,
  FacilityListItem,
} from "@hackaton/contracts";
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import type { DataSource, Repository } from "typeorm";
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
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  @Get("facilities")
  async listFacilities(): Promise<FacilityListItem[]> {
    const rows = await this.facilities.find({ order: { name: "ASC" } });
    const stats: {
      facility_id: string;
      audits: number;
      open_audits: number;
      compliant: number;
      non_compliant: number;
    }[] = await this.db.query(
      `SELECT f.id AS facility_id,
              (SELECT count(*)::int FROM audit a WHERE a.facility_id = f.id) AS audits,
              (SELECT count(*)::int FROM audit a WHERE a.facility_id = f.id AND a.status <> 'closed') AS open_audits,
              count(*) FILTER (WHERE ai.result = 'compliant')::int AS compliant,
              count(*) FILTER (WHERE ai.result = 'non_compliant')::int AS non_compliant
       FROM facility f
       LEFT JOIN LATERAL (
         SELECT a.id FROM audit a
         WHERE a.facility_id = f.id AND a.status IN ('published', 'closed')
         ORDER BY coalesce(a.published_at, a.created_at) DESC LIMIT 1
       ) latest ON true
       LEFT JOIN audit_item ai ON ai.audit_id = latest.id
       GROUP BY f.id`,
    );
    const byId = new Map(stats.map((row) => [row.facility_id, row]));

    return rows.map((row) => {
      const stat = byId.get(row.id);
      const assessed = (stat?.compliant ?? 0) + (stat?.non_compliant ?? 0);
      return {
        ...toFacility(row),
        summary: {
          score: assessed > 0 ? (stat?.compliant ?? 0) / assessed : null,
          audits: stat?.audits ?? 0,
          openAudits: stat?.open_audits ?? 0,
        },
      };
    });
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
