import type {
  AuditDetail,
  AuditItem,
  AuditResult,
  AuditSummary,
  Evidence,
  NaReason,
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
import type { DataSource, EntityManager } from "typeorm";
import { toAuthority } from "../catalog/catalog.mapper.js";
import { AuthorityEntity } from "../catalog/entities/authority.entity.js";
import { sha256Hex } from "../llm/canonical-json.js";
import { ObligationsService } from "../obligations/obligations.service.js";
import { STORAGE, type StorageService } from "../storage/storage.service.js";
import type {
  AddManualRequirementDto,
  AssessItemDto,
  CreateAuditDto,
} from "./audits.dto.js";
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
  originalname: string;
}

@Injectable()
export class AuditsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(STORAGE) private readonly storage: StorageService,
    private readonly obligations: ObligationsService,
  ) {}

  async create(
    dto: CreateAuditDto,
    actor: string | null,
  ): Promise<AuditDetail> {
    if (dto.periodFrom && dto.periodTo && dto.periodFrom > dto.periodTo) {
      throw new BadRequestException("El período termina antes de empezar.");
    }

    if (dto.clientId) {
      const replay = await this.db
        .getRepository(AuditEntity)
        .findOneBy({ clientId: dto.clientId });
      if (replay) return this.detail(replay.id);
    }

    const [audit] = await this.db.query(
      `INSERT INTO audit (facility_id, authority_id, title, kind, period_from, period_to, planned_on, created_by_name, client_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        dto.facilityId,
        dto.authorityId ?? null,
        dto.title.trim(),
        dto.kind,
        dto.periodFrom ?? null,
        dto.periodTo ?? null,
        dto.plannedOn,
        actor,
        dto.clientId ?? null,
      ],
    );
    return this.detail(audit.id);
  }

  async generate(id: string): Promise<AuditDetail> {
    const audit = await this.writableAudit(id);
    if (audit.status === "draft") {
      await this.db.query(
        `UPDATE audit SET status = 'in_validation' WHERE id = $1`,
        [id],
      );
    }
    return this.detail(id);
  }

  async publish(
    id: string,
    excludedCategories: string[],
    actor: string,
  ): Promise<AuditDetail> {
    const audit = await this.writableAudit(id);
    if (audit.status === "published") {
      throw new ConflictException("La auditoría ya está publicada.");
    }

    await this.db.transaction(async (manager) => {
      await manager.query(
        `UPDATE audit SET status = 'published', published_at = now(), validated_by_name = $2, excluded_categories = $3 WHERE id = $1`,
        [id, actor, excludedCategories],
      );
      await this.addValidatedItems(manager, audit, excludedCategories);
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
      .find({ where: { auditId: id }, order: { position: "ASC" } });
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
    const [version] = (await this.db.query(
      `SELECT status FROM obligation_version WHERE id = $1`,
      [obligationVersionId],
    )) as { status: string }[];
    if (version?.status !== "validated") {
      throw new ConflictException("Solo se auditan requisitos validados.");
    }

    return this.insertItem(this.db.manager, auditId, obligationVersionId);
  }

  async addManualRequirement(
    auditId: string,
    dto: AddManualRequirementDto,
    actor: string,
  ): Promise<AuditItem> {
    const audit = await this.writableAudit(auditId);

    const versionId = await this.db.transaction(async (manager) => {
      const authorityId =
        dto.authorityId ??
        audit.authorityId ??
        (await manager.query(`SELECT id FROM authority WHERE code = 'SMA'`))[0]
          .id;
      const key = `manual/${dto.clientId ?? randomUUID()}`;

      const [obligation] = await manager.query(
        `INSERT INTO obligation (facility_id, authority_id, category, key, origin)
         VALUES ($1, $2, $3, $4, 'manual')
         ON CONFLICT (facility_id, key) DO UPDATE SET key = EXCLUDED.key
         RETURNING id`,
        [audit.facilityId, authorityId, dto.category.trim(), key],
      );
      const [version] = await manager.query(
        `INSERT INTO obligation_version
           (obligation_id, seq, title, body, frequency, expected_evidence, due_date, status, validated_by, validated_at, valid_from)
         VALUES ($1, 1, $2, $3, $4, $5, $6, 'validated', $7, now(), now())
         ON CONFLICT (obligation_id, seq) DO UPDATE SET title = obligation_version.title
         RETURNING id`,
        [
          obligation.id,
          dto.title.trim(),
          dto.body.trim(),
          dto.frequency ?? null,
          dto.expectedEvidence ?? null,
          dto.dueDate ?? null,
          actor,
        ],
      );
      return version.id as string;
    });

    if (audit.status === "published") {
      return this.insertItem(this.db.manager, auditId, versionId);
    }
    const [item] = await this.obligations.versionsById([versionId]);
    return manualPreview(auditId, item!);
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
    const audit = await this.writableAudit(item.auditId);
    if (audit.status !== "published") {
      throw new ConflictException("La auditoría todavía no está publicada.");
    }
    if (dto.result === "non_compliant" && !dto.notes?.trim()) {
      throw new BadRequestException("«No cumple» exige una observación.");
    }
    if (dto.result === "not_applicable" && !dto.naReason) {
      throw new BadRequestException("«No aplica» exige un motivo.");
    }
    if (dto.naReason === "other" && !dto.notes?.trim()) {
      throw new BadRequestException("«Otro motivo» exige una explicación.");
    }

    await this.db.query(
      `UPDATE audit_item SET result = $2, notes = $3, na_reason = $4, assessed_by_name = $5, assessed_at = now() WHERE id = $1`,
      [
        itemId,
        dto.result,
        dto.notes ?? null,
        dto.result === "not_applicable" ? dto.naReason : null,
        actor,
      ],
    );

    const [mapped] = await this.toItems([await this.item(itemId)]);
    return mapped!;
  }

  async markCategoryNotApplicable(
    auditId: string,
    category: string,
    naReason: NaReason,
    notes: string | null,
    actor: string,
  ): Promise<AuditItem[]> {
    const audit = await this.writableAudit(auditId);
    if (audit.status !== "published") {
      throw new ConflictException("La auditoría todavía no está publicada.");
    }
    if (naReason === "other" && !notes?.trim()) {
      throw new BadRequestException("«Otro motivo» exige una explicación.");
    }

    const [rows] = await this.db.query(
      `UPDATE audit_item ai SET result = 'not_applicable', na_reason = $3, notes = $4, assessed_by_name = $5, assessed_at = now()
       FROM obligation_version v JOIN obligation o ON o.id = v.obligation_id
       WHERE ai.audit_id = $1 AND v.id = ai.obligation_version_id AND o.category = $2
       RETURNING ai.id`,
      [auditId, category, naReason, notes, actor],
    );
    const ids = ((rows as { id: string }[] | undefined) ?? []).map((r) => r.id);
    if (ids.length === 0) return [];
    const items = await this.db
      .getRepository(AuditItemEntity)
      .createQueryBuilder("i")
      .where("i.id IN (:...ids)", { ids })
      .orderBy("i.position")
      .getMany();
    return this.toItems(items);
  }

  async close(id: string): Promise<AuditDetail> {
    await this.writableAudit(id);
    await this.db.query(
      `UPDATE audit SET status = 'closed', closed_at = now() WHERE id = $1`,
      [id],
    );
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
    uploadedByName: string | null,
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
        filename: decodeFilename(file.originalname),
        uploadedByName,
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

  async deleteEvidence(id: string): Promise<void> {
    const evidence = await this.db
      .getRepository(EvidenceEntity)
      .findOneBy({ id });
    if (!evidence) return;
    if (evidence.auditItemId) {
      const item = await this.item(evidence.auditItemId);
      await this.writableAudit(item.auditId);
    }
    await this.db.getRepository(EvidenceEntity).delete({ id });
    await this.storage.delete(evidence.storageKey);
  }

  async evidenceUrl(id: string): Promise<string> {
    const evidence = await this.db
      .getRepository(EvidenceEntity)
      .findOneBy({ id });
    if (!evidence) throw new NotFoundException("Evidencia no encontrada.");
    return this.storage.presignedGetUrl(
      evidence.storageKey,
      evidence.filename ?? undefined,
    );
  }

  private async addValidatedItems(
    manager: EntityManager,
    audit: AuditEntity,
    excludedCategories: string[],
  ): Promise<void> {
    await manager.query(
      `INSERT INTO audit_item (audit_id, obligation_version_id, position)
       SELECT $1, v.id,
              coalesce((SELECT max(position) FROM audit_item WHERE audit_id = $1), 0)
                + row_number() OVER (ORDER BY o.category, o.key)
       FROM obligation_version v
       JOIN obligation o ON o.id = v.obligation_id
       WHERE o.facility_id = $2
         AND v.status = 'validated'
         AND ($3::uuid IS NULL OR o.authority_id = $3)
         AND NOT (o.category = ANY($4::text[]))
       ON CONFLICT (audit_id, obligation_version_id) DO NOTHING`,
      [audit.id, audit.facilityId, audit.authorityId, excludedCategories],
    );
  }

  private async insertItem(
    manager: EntityManager,
    auditId: string,
    obligationVersionId: string,
  ): Promise<AuditItem> {
    await manager.query(
      `INSERT INTO audit_item (audit_id, obligation_version_id, position)
       VALUES ($1, $2, coalesce((SELECT max(position) FROM audit_item WHERE audit_id = $1), 0) + 1)
       ON CONFLICT (audit_id, obligation_version_id) DO NOTHING`,
      [auditId, obligationVersionId],
    );
    const item = await manager
      .getRepository(AuditItemEntity)
      .findOneByOrFail({ auditId, obligationVersionId });
    const [mapped] = await this.toItems([item]);
    return mapped!;
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
          position: item.position,
          result: item.result,
          notes: item.notes,
          naReason: item.naReason,
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
    const authority = audit.authorityId
      ? authorities.get(audit.authorityId)
      : null;
    return {
      id: audit.id,
      facilityId: audit.facilityId,
      title: audit.title,
      authority: authority ? toAuthority(authority) : null,
      kind: audit.kind,
      periodFrom: audit.periodFrom,
      periodTo: audit.periodTo,
      plannedOn: audit.plannedOn ?? "",
      status: audit.status,
      createdByName: audit.createdByName,
      validatedByName: audit.validatedByName,
      excludedCategories: audit.excludedCategories,
      createdAt: audit.createdAt.toISOString(),
      publishedAt: audit.publishedAt?.toISOString() ?? null,
      closedAt: audit.closedAt?.toISOString() ?? null,
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

function manualPreview(
  auditId: string,
  version: AuditItem["version"],
): AuditItem {
  return {
    id: "",
    auditId,
    obligationId: version.obligationId,
    version,
    position: 0,
    result: "pending",
    notes: null,
    naReason: null,
    assessedByName: null,
    assessedAt: null,
    evidence: [],
  };
}

function toEvidence(entity: EvidenceEntity): Evidence {
  const fileUrl = `/api/evidence/${entity.id}/file`;
  return {
    id: entity.id,
    auditItemId: entity.auditItemId ?? "",
    obligationId: entity.obligationId,
    sha256: entity.sha256,
    mime: entity.mime,
    filename: entity.filename,
    uploadedByName: entity.uploadedByName,
    fileUrl,
    thumbUrl: entity.mime.startsWith("image/") ? fileUrl : null,
    capturedAt: (entity.capturedAt ?? entity.createdAt).toISOString(),
    clientId: entity.clientId,
    createdAt: entity.createdAt.toISOString(),
  };
}

function decodeFilename(name: string): string {
  const decoded = Buffer.from(name, "latin1").toString("utf8");
  return decoded.includes("�") ? name : decoded;
}
