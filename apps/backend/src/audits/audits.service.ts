import type {
  AuditDetail,
  AuditItem,
  AuditResult,
  AuditSummary,
  Evidence,
} from "@hackaton/contracts";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import type { DataSource } from "typeorm";
import { toAuthority } from "../catalog/catalog.mapper.js";
import { AuthorityEntity } from "../catalog/entities/authority.entity.js";
import { sha256Hex } from "../llm/canonical-json.js";
import { ObligationsService } from "../obligations/obligations.service.js";
import { STORAGE, type StorageService } from "../storage/storage.service.js";
import type { AssessItemDto, CreateAuditDto } from "./audits.dto.js";
import { AuditItemEntity } from "./entities/audit-item.entity.js";
import { AuditEntity } from "./entities/audit.entity.js";
import { EvidenceEntity } from "./entities/evidence.entity.js";

const RESULTS: AuditResult[] = [
  "compliant",
  "non_compliant",
  "not_applicable",
  "pending",
];

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
}

@Injectable()
export class AuditsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(STORAGE) private readonly storage: StorageService,
    private readonly obligations: ObligationsService,
  ) {}

  async create(dto: CreateAuditDto): Promise<AuditDetail> {
    if (dto.periodFrom > dto.periodTo) {
      throw new BadRequestException("El período termina antes de empezar.");
    }

    const id = await this.db.transaction(async (manager) => {
      const [audit] = await manager.query(
        `INSERT INTO audit (facility_id, authority_id, kind, period_from, period_to, planned_on)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          dto.facilityId,
          dto.authorityId,
          dto.kind,
          dto.periodFrom,
          dto.periodTo,
          dto.plannedOn,
        ],
      );
      await manager.query(
        `INSERT INTO audit_item (audit_id, obligation_version_id)
         SELECT $1, v.id
         FROM obligation_version v
         JOIN obligation o ON o.id = v.obligation_id
         WHERE o.facility_id = $2 AND o.authority_id = $3 AND v.status = 'validated'`,
        [audit.id, dto.facilityId, dto.authorityId],
      );
      return audit.id as string;
    });

    return this.detail(id);
  }

  async list(facilityId: string): Promise<AuditSummary[]> {
    const audits = await this.db.getRepository(AuditEntity).find({
      where: { facilityId },
      order: { plannedOn: "DESC", createdAt: "DESC" },
    });
    const counts = await this.itemCounts(audits.map((a) => a.id));
    const authorities = await this.authoritiesById();
    return audits.map((audit) =>
      this.toSummary(audit, authorities, counts.get(audit.id)),
    );
  }

  async detail(id: string): Promise<AuditDetail> {
    const audit = await this.audit(id);
    const items = await this.db
      .getRepository(AuditItemEntity)
      .find({ where: { auditId: id } });
    const counts = await this.itemCounts([id]);
    return {
      ...this.toSummary(audit, await this.authoritiesById(), counts.get(id)),
      items: await this.toItems(items),
    };
  }

  async addItem(
    auditId: string,
    obligationVersionId: string,
  ): Promise<AuditItem> {
    await this.writableAudit(auditId);
    const [{ status }] = (await this.db.query(
      `SELECT status FROM obligation_version WHERE id = $1`,
      [obligationVersionId],
    )) as { status: string }[];
    if (status !== "validated") {
      throw new ConflictException("Solo se auditan requisitos validados.");
    }

    await this.db.query(
      `INSERT INTO audit_item (audit_id, obligation_version_id) VALUES ($1, $2)
       ON CONFLICT (audit_id, obligation_version_id) DO NOTHING`,
      [auditId, obligationVersionId],
    );
    const item = await this.db
      .getRepository(AuditItemEntity)
      .findOneByOrFail({ auditId, obligationVersionId });
    const [mapped] = await this.toItems([item]);
    return mapped!;
  }

  async removeItem(auditId: string, itemId: string): Promise<void> {
    await this.writableAudit(auditId);
    await this.db.query(
      `DELETE FROM audit_item WHERE id = $1 AND audit_id = $2`,
      [itemId, auditId],
    );
  }

  async assess(
    itemId: string,
    dto: AssessItemDto,
    actor: string,
  ): Promise<AuditItem> {
    const item = await this.item(itemId);
    await this.writableAudit(item.auditId);

    await this.db.transaction(async (manager) => {
      await manager.query(
        `UPDATE audit_item SET result = $2, notes = $3, assessed_by_name = $4, assessed_at = now() WHERE id = $1`,
        [itemId, dto.result, dto.notes ?? null, actor],
      );
      await manager.query(
        `UPDATE audit SET status = 'in_progress' WHERE id = $1 AND status = 'planned'`,
        [item.auditId],
      );
    });

    const [mapped] = await this.toItems([await this.item(itemId)]);
    return mapped!;
  }

  async close(id: string): Promise<AuditDetail> {
    await this.writableAudit(id);
    await this.db.query(`UPDATE audit SET status = 'closed' WHERE id = $1`, [
      id,
    ]);
    return this.detail(id);
  }

  async findEvidenceByClientId(clientId: string): Promise<Evidence | null> {
    const existing = await this.db
      .getRepository(EvidenceEntity)
      .findOneBy({ clientId });
    return existing ? toEvidence(existing) : null;
  }

  async uploadEvidence(
    itemId: string,
    file: UploadedFile,
    clientId: string,
    capturedAt: string | undefined,
  ): Promise<Evidence> {
    const item = await this.item(itemId);
    await this.writableAudit(item.auditId);

    const [scope] = (await this.db.query(
      `SELECT o.id AS obligation_id, o.facility_id
       FROM obligation_version v JOIN obligation o ON o.id = v.obligation_id
       WHERE v.id = $1`,
      [item.obligationVersionId],
    )) as { obligation_id: string; facility_id: string }[];

    const id = randomUUID();
    const storageKey = `evidence/${id}`;
    await this.storage.put(storageKey, file.buffer, file.mimetype);

    const repository = this.db.getRepository(EvidenceEntity);
    try {
      await repository.insert({
        id,
        facilityId: scope!.facility_id,
        obligationId: scope!.obligation_id,
        auditItemId: itemId,
        sha256: sha256Hex(file.buffer),
        storageKey,
        mime: file.mimetype,
        capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
        clientId,
      });
    } catch (error) {
      const replay = await repository.findOneBy({ clientId });
      if (!replay) throw error;
      await this.storage.delete(storageKey);
      return toEvidence(replay);
    }

    return toEvidence(await repository.findOneByOrFail({ id }));
  }

  async evidenceUrl(id: string): Promise<string> {
    const evidence = await this.db
      .getRepository(EvidenceEntity)
      .findOneBy({ id });
    if (!evidence) throw new NotFoundException("Evidencia no encontrada.");
    return this.storage.presignedGetUrl(evidence.storageKey);
  }

  private async audit(id: string): Promise<AuditEntity> {
    const audit = await this.db.getRepository(AuditEntity).findOneBy({ id });
    if (!audit) throw new NotFoundException("Auditoría no encontrada.");
    return audit;
  }

  private async writableAudit(id: string): Promise<AuditEntity> {
    const audit = await this.audit(id);
    if (audit.status === "closed") {
      throw new ConflictException("La auditoría está cerrada.");
    }
    return audit;
  }

  private async item(id: string): Promise<AuditItemEntity> {
    const item = await this.db.getRepository(AuditItemEntity).findOneBy({ id });
    if (!item) throw new NotFoundException("Ítem de auditoría no encontrado.");
    return item;
  }

  private async toItems(items: AuditItemEntity[]): Promise<AuditItem[]> {
    if (items.length === 0) return [];
    const versions = await this.obligations.versionsById(
      items.map((item) => item.obligationVersionId),
    );
    const evidence = await this.db
      .getRepository(EvidenceEntity)
      .createQueryBuilder("e")
      .where("e.audit_item_id IN (:...ids)", { ids: items.map((i) => i.id) })
      .orderBy("e.created_at")
      .getMany();

    return items.flatMap((item) => {
      const version = versions.find((v) => v.id === item.obligationVersionId);
      if (!version) return [];
      return [
        {
          id: item.id,
          auditId: item.auditId,
          obligationId: version.obligationId,
          version,
          result: item.result,
          notes: item.notes,
          assessedByName: item.assessedByName,
          assessedAt: item.assessedAt?.toISOString() ?? null,
          evidence: evidence
            .filter((e) => e.auditItemId === item.id)
            .map(toEvidence),
        },
      ];
    });
  }

  private async itemCounts(
    auditIds: string[],
  ): Promise<Map<string, Record<AuditResult, number>>> {
    const counts = new Map<string, Record<AuditResult, number>>();
    if (auditIds.length === 0) return counts;

    const rows: { audit_id: string; result: AuditResult; count: number }[] =
      await this.db.query(
        `SELECT audit_id, result, count(*)::int AS count FROM audit_item
         WHERE audit_id = ANY($1::uuid[]) GROUP BY audit_id, result`,
        [auditIds],
      );
    for (const row of rows) {
      const record = counts.get(row.audit_id) ?? emptyCounts();
      record[row.result] = row.count;
      counts.set(row.audit_id, record);
    }
    return counts;
  }

  private async authoritiesById(): Promise<Map<string, AuthorityEntity>> {
    const rows = await this.db.getRepository(AuthorityEntity).find();
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toSummary(
    audit: AuditEntity,
    authorities: Map<string, AuthorityEntity>,
    counts: Record<AuditResult, number> | undefined,
  ): AuditSummary {
    return {
      id: audit.id,
      facilityId: audit.facilityId,
      authority: toAuthority(authorities.get(audit.authorityId)!),
      kind: audit.kind,
      periodFrom: audit.periodFrom ?? "",
      periodTo: audit.periodTo ?? "",
      plannedOn: audit.plannedOn ?? "",
      status: audit.status,
      itemCounts: counts ?? emptyCounts(),
    };
  }
}

function emptyCounts(): Record<AuditResult, number> {
  return Object.fromEntries(RESULTS.map((result) => [result, 0])) as Record<
    AuditResult,
    number
  >;
}

function toEvidence(entity: EvidenceEntity): Evidence {
  return {
    id: entity.id,
    auditItemId: entity.auditItemId ?? "",
    obligationId: entity.obligationId,
    sha256: entity.sha256,
    mime: entity.mime,
    capturedAt: (entity.capturedAt ?? entity.createdAt).toISOString(),
    clientId: entity.clientId,
    createdAt: entity.createdAt.toISOString(),
  };
}
