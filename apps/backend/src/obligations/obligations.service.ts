import type {
  ObligationDetail,
  ObligationListItem,
  ObligationSource,
  ObligationVersion,
} from "@hackaton/contracts";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import { toAuthority } from "../catalog/catalog.mapper.js";
import { AuthorityEntity } from "../catalog/entities/authority.entity.js";
import { ObligationSourceEntity } from "./entities/obligation-source.entity.js";
import { ObligationVersionEntity } from "./entities/obligation-version.entity.js";
import { ObligationEntity } from "./entities/obligation.entity.js";
import type {
  ListObligationsQuery,
  UpdateDraftDto,
  UpdateObligationDto,
} from "./obligations.dto.js";

const DRAFT_FIELDS = [
  "title",
  "body",
  "phase",
  "frequency",
  "expectedEvidence",
  "dueDate",
  "dueRule",
  "attributes",
] as const;

@Injectable()
export class ObligationsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async list(
    facilityId: string,
    query: ListObligationsQuery,
  ): Promise<ObligationListItem[]> {
    const obligations = await this.db.getRepository(ObligationEntity).find({
      where: {
        facilityId,
        ...(query.authorityId ? { authorityId: query.authorityId } : {}),
      },
      order: { key: "ASC" },
    });
    if (obligations.length === 0) return [];

    const versions = await this.versionsOf(obligations.map((o) => o.id));
    const authorities = await this.authoritiesById();
    const items: ObligationListItem[] = [];

    for (const obligation of obligations) {
      const own = versions.filter((v) => v.obligationId === obligation.id);
      const current = own.find((v) => v.status === "validated") ?? null;
      const shown = query.status
        ? own.filter((v) => v.status === query.status).at(-1)
        : (own.find((v) => v.status === "draft") ?? current ?? own.at(-1));
      if (!shown) continue;
      if (
        query.documentId &&
        !shown.sources.some((s) => s.documentId === query.documentId)
      ) {
        continue;
      }

      items.push({
        obligationId: obligation.id,
        key: obligation.key,
        category: obligation.category,
        authority: toAuthority(authorities.get(obligation.authorityId)!),
        version: shown,
        currentVersionId: current?.id ?? null,
      });
    }

    return items;
  }

  async detail(id: string): Promise<ObligationDetail> {
    const obligation = await this.db
      .getRepository(ObligationEntity)
      .findOneBy({ id });
    if (!obligation) throw new NotFoundException("Requisito no encontrado.");

    const authorities = await this.authoritiesById();
    return {
      id: obligation.id,
      facilityId: obligation.facilityId,
      key: obligation.key,
      category: obligation.category,
      authority: toAuthority(authorities.get(obligation.authorityId)!),
      versions: await this.versionsOf([obligation.id]),
    };
  }

  async update(
    id: string,
    changes: UpdateObligationDto,
  ): Promise<ObligationDetail> {
    const repository = this.db.getRepository(ObligationEntity);
    if (!(await repository.existsBy({ id }))) {
      throw new NotFoundException("Requisito no encontrado.");
    }
    if (changes.authorityId || changes.category) {
      await repository.update(id, changes);
    }
    return this.detail(id);
  }

  async updateDraft(
    versionId: string,
    changes: UpdateDraftDto,
  ): Promise<ObligationVersion> {
    const repository = this.db.getRepository(ObligationVersionEntity);
    const version = await repository.findOneBy({ id: versionId });
    if (!version) throw new NotFoundException("Versión no encontrada.");
    if (version.status !== "draft") {
      throw new ConflictException("Solo se puede editar un borrador.");
    }

    for (const field of DRAFT_FIELDS) {
      if (changes[field] !== undefined) {
        Object.assign(version, { [field]: changes[field] });
      }
    }
    await repository.save(version);

    return this.version(versionId);
  }

  async validate(versionId: string, actor: string): Promise<ObligationVersion> {
    await this.db.transaction(async (manager) => {
      const version = await this.lockDraft(manager, versionId);

      await manager.query(
        `UPDATE obligation_version SET status = 'superseded', valid_to = now()
         WHERE obligation_id = $1 AND status = 'validated'`,
        [version.obligationId],
      );

      try {
        await manager.query(
          `UPDATE obligation_version
           SET status = 'validated', validated_by = $2, validated_at = now(), valid_from = now()
           WHERE id = $1`,
          [versionId, actor],
        );
      } catch (error) {
        if (String(error).includes("obligation_version_one_validated_idx")) {
          throw new ConflictException(
            "Otra versión de este requisito se validó al mismo tiempo.",
          );
        }
        throw error;
      }
    });

    return this.version(versionId);
  }

  async reject(versionId: string): Promise<ObligationVersion> {
    await this.db.transaction(async (manager) => {
      await this.lockDraft(manager, versionId);
      await manager.query(
        `UPDATE obligation_version SET status = 'revoked' WHERE id = $1`,
        [versionId],
      );
    });
    return this.version(versionId);
  }

  private async lockDraft(
    manager: EntityManager,
    versionId: string,
  ): Promise<ObligationVersionEntity> {
    const version = await manager
      .getRepository(ObligationVersionEntity)
      .findOneBy({ id: versionId });
    if (!version) throw new NotFoundException("Versión no encontrada.");

    await manager.query(`SELECT id FROM obligation WHERE id = $1 FOR UPDATE`, [
      version.obligationId,
    ]);

    const [{ status }] = await manager.query(
      `SELECT status FROM obligation_version WHERE id = $1`,
      [versionId],
    );
    if (status !== "draft") {
      throw new ConflictException(
        `La versión está en estado «${status}»; solo se valida o rechaza un borrador.`,
      );
    }
    return version;
  }

  private async version(versionId: string): Promise<ObligationVersion> {
    const version = await this.db
      .getRepository(ObligationVersionEntity)
      .findOneByOrFail({ id: versionId });
    const [mapped] = await this.versionsOf([version.obligationId], [versionId]);
    return mapped!;
  }

  async versionsById(versionIds: string[]): Promise<ObligationVersion[]> {
    if (versionIds.length === 0) return [];
    const rows: { obligation_id: string }[] = await this.db.query(
      `SELECT DISTINCT obligation_id FROM obligation_version WHERE id = ANY($1::uuid[])`,
      [versionIds],
    );
    return this.versionsOf(
      rows.map((row) => row.obligation_id),
      versionIds,
    );
  }

  private async versionsOf(
    obligationIds: string[],
    onlyVersionIds?: string[],
  ): Promise<ObligationVersion[]> {
    const qb = this.db
      .getRepository(ObligationVersionEntity)
      .createQueryBuilder("v")
      .where("v.obligation_id IN (:...obligationIds)", { obligationIds })
      .orderBy("v.obligation_id")
      .addOrderBy("v.seq");
    if (onlyVersionIds) {
      qb.andWhere("v.id IN (:...onlyVersionIds)", { onlyVersionIds });
    }
    const versions = await qb.getMany();
    if (versions.length === 0) return [];

    const sources = await this.db
      .getRepository(ObligationSourceEntity)
      .createQueryBuilder("s")
      .where("s.obligation_version_id IN (:...ids)", {
        ids: versions.map((v) => v.id),
      })
      .getMany();
    const numbers = await this.documentNumbers(
      sources.map((s) => s.documentId),
    );

    return versions.map((version) =>
      toVersion(
        version,
        sources
          .filter((s) => s.obligationVersionId === version.id)
          .map((s) => toSource(s, numbers.get(s.documentId) ?? null)),
      ),
    );
  }

  private async documentNumbers(
    ids: string[],
  ): Promise<Map<string, string | null>> {
    if (ids.length === 0) return new Map();
    const rows: { id: string; number: string | null }[] = await this.db.query(
      `SELECT id, number FROM document WHERE id = ANY($1::uuid[])`,
      [[...new Set(ids)]],
    );
    return new Map(rows.map((row) => [row.id, row.number]));
  }

  private async authoritiesById(): Promise<Map<string, AuthorityEntity>> {
    const rows = await this.db.getRepository(AuthorityEntity).find();
    return new Map(rows.map((row) => [row.id, row]));
  }
}

function toSource(
  source: ObligationSourceEntity,
  documentNumber: string | null,
): ObligationSource {
  return {
    documentId: source.documentId,
    documentNumber,
    sectionKey: source.sectionKey,
    page: source.page,
    charStart: source.charStart,
    charEnd: source.charEnd,
    quote: source.quote,
    verified: source.page !== null && source.charStart !== null,
  };
}

function toVersion(
  version: ObligationVersionEntity,
  sources: ObligationSource[],
): ObligationVersion {
  return {
    id: version.id,
    obligationId: version.obligationId,
    seq: version.seq,
    title: version.title,
    body: version.body,
    phase: version.phase,
    frequency: version.frequency,
    expectedEvidence: version.expectedEvidence,
    dueDate: version.dueDate,
    dueRule: version.dueRule,
    attributes: version.attributes,
    status: version.status,
    validatedBy: version.validatedBy,
    validatedAt: version.validatedAt?.toISOString() ?? null,
    validFrom: version.validFrom?.toISOString() ?? null,
    validTo: version.validTo?.toISOString() ?? null,
    supersedesId: version.supersedesId,
    causedByDocumentId: version.causedByDocumentId,
    sources,
    createdAt: version.createdAt.toISOString(),
  };
}
