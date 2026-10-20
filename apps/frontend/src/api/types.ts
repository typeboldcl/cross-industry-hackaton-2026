import type {
  AddManualRequirementRequest,
  AssessItemRequest,
  AuditDetail,
  AuditItem,
  AuditSummary,
  Authority,
  CategoryNotApplicableRequest,
  CreateAuditRequest,
  DocumentDetail,
  DocumentKind,
  Evidence,
  Facility,
  FacilityContext,
  FacilityListItem,
  ImportDocumentRequest,
  ObligationListItem,
  ObligationVersion,
  UpdateDraftRequest,
} from "@hackaton/contracts";

/**
 * Los endpoints del backend (`apps/backend`, bajo `/api`), uno por método.
 * Las pantallas nunca llaman a esto directo: usan los hooks y acciones de
 * `src/api/index.ts`, que además refrescan la caché.
 *
 * Lo implementan `httpApi` (el backend real) y `demoApi` (un backend simulado
 * en el navegador, para presentar sin conexión al servidor).
 */
export interface AuditApi {
  facilities: {
    list(): Promise<FacilityListItem[]>;
    get(facilityId: string): Promise<Facility>;
    /** Documentos, pertinencias, alertas y auditorías del centro. */
    context(facilityId: string): Promise<FacilityContext>;
    authorities(): Promise<Authority[]>;
  };
  documents: {
    upload(
      facilityId: string,
      file: File,
      kind: DocumentKind,
      title?: string,
    ): Promise<DocumentDetail>;
    import(
      facilityId: string,
      req: ImportDocumentRequest,
    ): Promise<DocumentDetail>;
  };
  obligations: {
    list(facilityId: string): Promise<ObligationListItem[]>;
    updateDraft(
      versionId: string,
      req: UpdateDraftRequest,
    ): Promise<ObligationVersion>;
    validate(versionId: string): Promise<ObligationVersion>;
    reject(versionId: string): Promise<ObligationVersion>;
    restore(versionId: string): Promise<ObligationVersion>;
  };
  audits: {
    list(facilityId: string): Promise<AuditSummary[]>;
    get(auditId: string): Promise<AuditDetail>;
    create(req: CreateAuditRequest): Promise<AuditDetail>;
    /** Pasa la auditoría a validación (la extracción ocurre al subir documentos). */
    generate(auditId: string): Promise<AuditDetail>;
    /** Crea un ítem por cada requisito validado de las temáticas incluidas. */
    publish(
      auditId: string,
      excludedCategories: string[],
    ): Promise<AuditDetail>;
    addManualRequirement(
      auditId: string,
      req: AddManualRequirementRequest,
    ): Promise<AuditItem>;
    markCategoryNotApplicable(
      auditId: string,
      category: string,
      req: CategoryNotApplicableRequest,
    ): Promise<AuditItem[]>;
    close(auditId: string): Promise<AuditDetail>;
  };
  items: {
    assess(itemId: string, req: AssessItemRequest): Promise<AuditItem>;
  };
  evidence: {
    upload(
      itemId: string,
      file: File,
      clientId: string,
      capturedAt?: string,
    ): Promise<Evidence>;
    remove(evidenceId: string): Promise<void>;
  };
}

/** Error de la API con el mensaje que devolvió el backend (en español). */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
