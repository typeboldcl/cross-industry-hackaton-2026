import type { AuditResult, FacilityCompliance } from "@hackaton/contracts";
import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { aggregateCompliance } from "./compliance-aggregate.js";

interface Row {
  obligation_id: string;
  title: string;
  authority_id: string;
  authority_code: string;
  authority_name: string;
  result: AuditResult | null;
  audit_id: string | null;
  assessed_at: Date | null;
}

@Injectable()
export class ComplianceService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async summary(facilityId: string): Promise<FacilityCompliance> {
    const rows: Row[] = await this.db.query(
      `WITH latest AS (
         SELECT DISTINCT ON (v.obligation_id)
           v.obligation_id, ai.result, ai.audit_id, ai.assessed_at
         FROM audit_item ai
         JOIN obligation_version v ON v.id = ai.obligation_version_id
         WHERE ai.assessed_at IS NOT NULL
         ORDER BY v.obligation_id, ai.assessed_at DESC
       )
       SELECT o.id AS obligation_id, v.title, a.id AS authority_id, a.code AS authority_code, a.name AS authority_name,
              l.result, l.audit_id, l.assessed_at
       FROM obligation o
       JOIN obligation_version v ON v.obligation_id = o.id AND v.status = 'validated'
       JOIN authority a ON a.id = o.authority_id
       LEFT JOIN latest l ON l.obligation_id = o.id
       WHERE o.facility_id = $1
       ORDER BY a.code, v.title`,
      [facilityId],
    );

    return aggregateCompliance(
      facilityId,
      rows.map((row) => ({
        obligationId: row.obligation_id,
        title: row.title,
        authority: {
          id: row.authority_id,
          code: row.authority_code,
          name: row.authority_name,
        },
        result: row.result,
        lastAuditId: row.audit_id,
        lastAssessedAt: row.assessed_at
          ? new Date(row.assessed_at).toISOString()
          : null,
      })),
    );
  }
}
