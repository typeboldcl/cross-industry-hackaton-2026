import type {
  DocumentDetail,
  DocumentKind,
  DocumentSummary,
  ExtractionProgress,
} from "@hackaton/contracts";
import {
  Inject,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import type { DataSource, Repository } from "typeorm";
import { toAuthority } from "../catalog/catalog.mapper.js";
import { AuthorityEntity } from "../catalog/entities/authority.entity.js";
import { FacilityEntity } from "../catalog/entities/facility.entity.js";
import { sha256Hex } from "../llm/canonical-json.js";
import {
  PROCESSING_DISPATCHER,
  type ProcessingDispatcher,
} from "../processing/processing-dispatcher.js";
import { STORAGE, type StorageService } from "../storage/storage.service.js";
import { SeiaClient } from "../seia/seia.client.js";
import { numberFromFilename } from "./document-number.js";
import { DocumentEntity } from "./entities/document.entity.js";

const DEFAULT_ISSUER: Record<DocumentKind, string | null> = {
  rca: "SEA",
  rectificacion: "SEA",
  pertinencia: "SEA",
  res_sanitaria: "SEREMI_SALUD",
  norma: null,
  otro: null,
};

export interface UploadedPdf {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface UploadResult {
  document: DocumentDetail;
  created: boolean;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documents: Repository<DocumentEntity>,
    @InjectRepository(FacilityEntity)
    private readonly facilities: Repository<FacilityEntity>,
    @InjectRepository(AuthorityEntity)
    private readonly authorities: Repository<AuthorityEntity>,
    @InjectDataSource() private readonly db: DataSource,
    @Inject(STORAGE) private readonly storage: StorageService,
    @Inject(PROCESSING_DISPATCHER)
    private readonly dispatcher: ProcessingDispatcher,
    @Inject(SeiaClient) private readonly seia: SeiaClient,
  ) {}

  async upload(
    facilityId: string,
    file: UploadedPdf,
    kind: DocumentKind,
    title?: string,
    source?: { origin: "fetched"; url: string },
  ): Promise<UploadResult> {
    await this.assertFacility(facilityId);

    if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new UnsupportedMediaTypeException("El archivo no es un PDF.");
    }

    const sha256 = sha256Hex(file.buffer);
    const existing = await this.documents.findOneBy({ sha256 });
    if (existing) {
      return { document: await this.detail(existing.id), created: false };
    }

    const filename = decodeFilename(file.originalname);
    const id = randomUUID();
    const storageKey = `documents/${id}.pdf`;
    await this.storage.put(storageKey, file.buffer, "application/pdf");

    const issuerCode = DEFAULT_ISSUER[kind];
    const issuer = issuerCode
      ? await this.authorities.findOneBy({ code: issuerCode })
      : null;

    try {
      await this.documents.insert({
        id,
        facilityId,
        number: numberFromFilename(filename),
        sha256,
        storageKey,
        mime: "application/pdf",
        kind,
        issuerId: issuer?.id ?? null,
        title: title?.trim() || filename.replace(/\.pdf$/i, ""),
        origin: source?.origin ?? "uploaded",
        sourceUrl: source?.url ?? null,
      });
    } catch (error) {
      const raced = await this.documents.findOneBy({ sha256 });
      if (!raced) throw error;
      await this.storage.delete(storageKey);
      return { document: await this.detail(raced.id), created: false };
    }

    if (kind !== "otro") await this.dispatcher.dispatch(id);
    return { document: await this.detail(id), created: true };
  }

  async importFromUrl(
    facilityId: string,
    url: string,
    kind: DocumentKind,
    title?: string,
  ): Promise<UploadResult> {
    this.seia.assertAllowedUrl(url);
    await this.assertFacility(facilityId);
    const pdf = await this.seia.downloadPdf(url);
    return this.upload(
      facilityId,
      {
        buffer: pdf.buffer,
        originalname: pdf.filename,
        mimetype: "application/pdf",
      },
      kind,
      title,
      { origin: "fetched", url },
    );
  }

  async list(facilityId: string): Promise<DocumentSummary[]> {
    const rows = await this.documents.find({
      where: { facilityId },
      order: { createdAt: "DESC" },
    });
    const issuers = await this.issuersById();
    return rows.map((row) => this.toSummary(row, issuers));
  }

  async detail(id: string): Promise<DocumentDetail> {
    const document = await this.get(id);
    const issuers = await this.issuersById();
    return {
      ...this.toSummary(document, issuers),
      mime: document.mime,
      sha256: document.sha256,
      processingStatus: document.processingStatus,
      sourceUrl: document.sourceUrl,
      pageCount: null,
      extraction: await this.progressOf(document),
    };
  }

  async progress(id: string): Promise<ExtractionProgress> {
    return this.progressOf(await this.get(id));
  }

  async reprocess(id: string): Promise<ExtractionProgress> {
    const document = await this.get(id);
    await this.dispatcher.dispatch(document.id);
    return this.progress(id);
  }

  async fileUrl(id: string): Promise<string> {
    const document = await this.get(id);
    return this.storage.presignedGetUrl(
      document.storageKey,
      `${document.title}.pdf`,
    );
  }

  private async assertFacility(facilityId: string): Promise<void> {
    if (!(await this.facilities.existsBy({ id: facilityId }))) {
      throw new NotFoundException("Instalación no encontrada.");
    }
  }

  private async get(id: string): Promise<DocumentEntity> {
    const document = await this.documents.findOneBy({ id });
    if (!document) throw new NotFoundException("Documento no encontrado.");
    return document;
  }

  private async progressOf(
    document: DocumentEntity,
  ): Promise<ExtractionProgress> {
    const [{ drafts }] = await this.db.query(
      `SELECT count(DISTINCT s.obligation_version_id)::int AS drafts
       FROM obligation_source s
       JOIN obligation_version v ON v.id = s.obligation_version_id
       WHERE s.document_id = $1 AND v.status = 'draft'`,
      [document.id],
    );
    return {
      documentId: document.id,
      state: document.processingStatus,
      sectionsTotal: document.sectionsTotal,
      sectionsDone: document.sectionsDone,
      draftsCreated: drafts,
      error: document.processingError,
      repealCandidates: [],
    };
  }

  private async issuersById(): Promise<Map<string, AuthorityEntity>> {
    const rows = await this.authorities.find();
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toSummary(
    document: DocumentEntity,
    issuers: Map<string, AuthorityEntity>,
  ): DocumentSummary {
    const issuer = document.issuerId ? issuers.get(document.issuerId) : null;
    return {
      id: document.id,
      facilityId: document.facilityId,
      kind: document.kind,
      number: document.number,
      title: document.title,
      issuedOn: document.issuedOn,
      issuer: issuer ? toAuthority(issuer) : null,
      origin: document.origin,
      textExtractedAt: document.textExtractedAt?.toISOString() ?? null,
      createdAt: document.createdAt.toISOString(),
    };
  }
}

// Multer reads multipart filenames as latin1, so a UTF-8 name like "Rectificación" arrives mangled.
function decodeFilename(name: string): string {
  const decoded = Buffer.from(name, "latin1").toString("utf8");
  return decoded.includes("�") ? name : decoded;
}
