import type { FacilityContext, SeiaPertinencia } from "@hackaton/contracts";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import type { DataSource, Repository } from "typeorm";
import { AuditsService } from "../audits/audits.service.js";
import { toFacility } from "../catalog/catalog.mapper.js";
import { FacilityEntity } from "../catalog/entities/facility.entity.js";
import { DocumentsService } from "../documents/documents.service.js";
import { DocumentEntity } from "../documents/entities/document.entity.js";
import { SeiaClient } from "../seia/seia.client.js";
import { STORAGE, type StorageService } from "../storage/storage.service.js";
import {
  buildSummaryAlerts,
  deriveDocumentStatus,
  filterRelevantPertinencias,
  missingReferenceAlerts,
  toFacilityPertinencias,
  type CitingDocument,
  type DocumentFacts,
} from "./context.derivations.js";

const SEIA_CACHE_TTL_MS = 10 * 60 * 1000;
const SEIA_PAGE_SIZE = 50;

interface CachedPertinencias {
  expiresAt: number;
  items: SeiaPertinencia[];
}

@Injectable()
export class ContextService {
  private readonly pertinenciaCache = new Map<string, CachedPertinencias>();

  constructor(
    @InjectRepository(FacilityEntity)
    private readonly facilities: Repository<FacilityEntity>,
    @InjectRepository(DocumentEntity)
    private readonly documentRows: Repository<DocumentEntity>,
    @InjectDataSource() private readonly db: DataSource,
    @Inject(STORAGE) private readonly storage: StorageService,
    private readonly documents: DocumentsService,
    private readonly audits: AuditsService,
    private readonly seia: SeiaClient,
  ) {}

  async get(facilityId: string): Promise<FacilityContext> {
    const facility = await this.facilities.findOneBy({ id: facilityId });
    if (!facility) throw new NotFoundException("Instalación no encontrada.");

    const [summaries, rows, audits, pertinenciaResult, draftVersions] =
      await Promise.all([
        this.documents.list(facilityId),
        this.documentRows.findBy({ facilityId }),
        this.audits.list(facilityId),
        this.findPertinencias(facility),
        this.countDraftVersions(facilityId),
      ]);

    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const facts: DocumentFacts[] = rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      number: row.number,
      title: row.title,
      processingStatus: row.processingStatus,
      processingError: row.processingError,
      sectionsDone: row.sectionsDone,
      sectionsTotal: row.sectionsTotal,
    }));

    const documents = summaries.map((summary) => {
      const own = facts.find((fact) => fact.id === summary.id)!;
      return {
        ...summary,
        processingStatus: own.processingStatus,
        ...deriveDocumentStatus(own, facts),
      };
    });

    const pertinencias = toFacilityPertinencias(pertinenciaResult.items, facts);
    const citing = await this.loadCitingDocuments(
      summaries.map((s) => s.id),
      rowsById,
    );
    const { failed, info } = buildSummaryAlerts({
      unloadedPertinencias: pertinencias.filter((p) => !p.loaded).length,
      draftVersions,
      failedDocuments: facts.filter(
        (fact) => fact.processingStatus === "failed",
      ),
    });

    return {
      facility: toFacility(facility),
      documents,
      pertinencias,
      pertinenciasError: pertinenciaResult.error,
      alerts: [
        ...failed,
        ...missingReferenceAlerts(
          citing,
          facts.map((fact) => fact.number),
          pertinenciaResult.items,
        ),
        ...info,
      ],
      audits,
    };
  }

  private async findPertinencias(
    facility: FacilityEntity,
  ): Promise<{ items: SeiaPertinencia[]; error: string | null }> {
    const cached = this.pertinenciaCache.get(facility.id);
    if (cached && cached.expiresAt > Date.now()) {
      return { items: cached.items, error: null };
    }

    try {
      const [byName, byTitular] = await Promise.all([
        this.seia.searchPertinencias(facility.name, "", 0, SEIA_PAGE_SIZE),
        this.seia.searchPertinencias("", facility.titular, 0, SEIA_PAGE_SIZE),
      ]);
      const items = filterRelevantPertinencias(
        [...byName.items, ...byTitular.items],
        facility,
      );
      this.pertinenciaCache.set(facility.id, {
        items,
        expiresAt: Date.now() + SEIA_CACHE_TTL_MS,
      });
      return { items, error: null };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo consultar el SEIA.";
      return { items: [], error: message };
    }
  }

  private async countDraftVersions(facilityId: string): Promise<number> {
    const [{ count }] = (await this.db.query(
      `SELECT count(*)::int AS count
       FROM obligation_version v
       JOIN obligation o ON o.id = v.obligation_id
       WHERE o.facility_id = $1 AND v.status = 'draft'`,
      [facilityId],
    )) as { count: number }[];
    return count;
  }

  private async loadCitingDocuments(
    ids: string[],
    rowsById: Map<string, DocumentEntity>,
  ): Promise<CitingDocument[]> {
    const loaded = await Promise.all(
      ids.map(async (id): Promise<CitingDocument | null> => {
        const row = rowsById.get(id);
        if (!row) return null;
        const pages = await this.readCachedPages(row.sha256);
        return pages
          ? { id, number: row.number, title: row.title, pages }
          : null;
      }),
    );
    return loaded.filter((document) => document !== null);
  }

  private async readCachedPages(sha256: string): Promise<string[] | null> {
    const key = `text/${sha256}.pages.json`;
    try {
      if (!(await this.storage.exists(key))) return null;
      const stored = await this.storage.get(key);
      const parsed = JSON.parse(stored.body.toString("utf8")) as {
        pages?: unknown;
      };
      return Array.isArray(parsed.pages)
        ? parsed.pages.filter((page) => typeof page === "string")
        : null;
    } catch {
      return null;
    }
  }
}
