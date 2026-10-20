import type {
  AddManualRequirementRequest,
  AssessItemRequest,
  AuditDetail,
  AuditItem,
  CategoryNotApplicableRequest,
  CreateAuditRequest,
  DocumentKind,
  ImportDocumentRequest,
  UpdateDraftRequest,
} from "@hackaton/contracts";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { useSession } from "../store/useSession";
import { toast } from "../store/useUiStore";
import { demoApi } from "./demo/demoApi";
import { httpApi } from "./httpApi";
import { ApiError, type AuditApi } from "./types";

export { ApiError } from "./types";
export type { AuditApi } from "./types";
export { demoControls } from "./demo/demoApi";

/** El backend activo: el real o el simulado (modo demo), según la sesión. */
const api = (): AuditApi =>
  useSession.getState().apiMode === "http" ? httpApi : demoApi;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
  },
});

// Al cambiar entre demo y backend real, los datos en caché ya no sirven.
useSession.subscribe((s, prev) => {
  if (s.apiMode !== prev.apiMode) queryClient.clear();
});

const keys = {
  facilities: ["facilities"] as const,
  context: (id: string) => ["context", id] as const,
  obligations: (id: string) => ["obligations", id] as const,
  audit: (id: string) => ["audit", id] as const,
  authorities: ["authorities"] as const,
};

// ---------------------------------------------------------------------------
// Lecturas (hooks)
// ---------------------------------------------------------------------------

export const useFacilities = () =>
  useQuery({
    queryKey: keys.facilities,
    queryFn: () => api().facilities.list(),
  });

/** Documentos, pertinencias, alertas y auditorías de un centro. */
export const useFacilityContext = (facilityId: string | undefined) =>
  useQuery({
    queryKey: keys.context(facilityId ?? ""),
    queryFn: () => api().facilities.context(facilityId!),
    enabled: !!facilityId,
  });

/** Requisitos de la instalación (todas sus versiones vigentes). */
export const useObligations = (facilityId: string | undefined) =>
  useQuery({
    queryKey: keys.obligations(facilityId ?? ""),
    queryFn: () => api().obligations.list(facilityId!),
    enabled: !!facilityId,
  });

export const useAudit = (auditId: string | undefined) =>
  useQuery({
    queryKey: keys.audit(auditId ?? ""),
    queryFn: () => api().audits.get(auditId!),
    enabled: !!auditId,
  });

// ---------------------------------------------------------------------------
// Acciones: llaman a la API y refrescan lo que cambió
// ---------------------------------------------------------------------------

const refresh = (...queryKeys: readonly (readonly string[])[]) =>
  Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );

/** Cambios en una auditoría: su detalle, el centro y la lista de centros. */
const refreshAudit = (auditId: string, facilityId: string) =>
  refresh(keys.audit(auditId), keys.context(facilityId), keys.facilities);

/** Reemplaza un ítem en la caché de la auditoría (respuesta inmediata en terreno). */
function putItems(auditId: string, items: AuditItem[]) {
  queryClient.setQueryData<AuditDetail>(keys.audit(auditId), (old) =>
    old
      ? {
          ...old,
          items: old.items.map((i) => items.find((x) => x.id === i.id) ?? i),
        }
      : old,
  );
}

/** Revierte un cambio hecho en terreno (botón "Deshacer"). */
export type Undo = () => Promise<void>;

const previous = (i: AuditItem): AssessItemRequest => ({
  result: i.result,
  notes: i.notes,
  naReason: i.naReason,
});

export const actions = {
  async createAudit(req: CreateAuditRequest) {
    const audit = await api().audits.create({
      clientId: crypto.randomUUID(),
      ...req,
    });
    await refresh(keys.context(req.facilityId), keys.facilities);
    return audit;
  },
  async uploadDocument(facilityId: string, file: File, kind: DocumentKind) {
    await api().documents.upload(facilityId, file, kind);
    await refresh(keys.context(facilityId));
  },
  async importDocument(facilityId: string, req: ImportDocumentRequest) {
    await api().documents.import(facilityId, req);
    await refresh(keys.context(facilityId));
  },
  async generate(auditId: string, facilityId: string) {
    await api().audits.generate(auditId);
    await refresh(
      keys.obligations(facilityId),
      keys.audit(auditId),
      keys.context(facilityId),
    );
  },
  async validate(versionIds: string[], facilityId: string) {
    for (const id of versionIds) await api().obligations.validate(id);
    await refresh(keys.obligations(facilityId));
  },
  async reject(versionId: string, facilityId: string) {
    await api().obligations.reject(versionId);
    await refresh(keys.obligations(facilityId));
  },
  async restore(versionId: string, facilityId: string) {
    await api().obligations.restore(versionId);
    await refresh(keys.obligations(facilityId));
  },
  async editDraft(
    versionId: string,
    facilityId: string,
    req: UpdateDraftRequest,
  ) {
    await api().obligations.updateDraft(versionId, req);
    await refresh(keys.obligations(facilityId));
  },
  async publish(
    auditId: string,
    facilityId: string,
    excludedCategories: string[],
  ) {
    await api().audits.publish(auditId, excludedCategories);
    await refreshAudit(auditId, facilityId);
  },
  async addManualRequirement(
    auditId: string,
    facilityId: string,
    req: AddManualRequirementRequest,
  ) {
    const item = await api().audits.addManualRequirement(auditId, {
      clientId: crypto.randomUUID(),
      ...req,
    });
    await refresh(keys.obligations(facilityId));
    await refreshAudit(auditId, facilityId);
    return item;
  },
  /** Marca un ítem y devuelve cómo deshacerlo. */
  async assess(
    auditId: string,
    facilityId: string,
    item: AuditItem,
    req: AssessItemRequest,
  ): Promise<Undo> {
    const updated = await api().items.assess(item.id, req);
    putItems(auditId, [updated]);
    void refreshAudit(auditId, facilityId);
    const before = previous(item);
    return async () => {
      putItems(auditId, [await api().items.assess(item.id, before)]);
      await refreshAudit(auditId, facilityId);
    };
  },
  /** "Tema no aplica": marca toda la temática y devuelve cómo deshacerlo. */
  async categoryNotApplicable(
    audit: AuditDetail,
    category: string,
    req: CategoryNotApplicableRequest,
  ): Promise<{ count: number; undo: Undo }> {
    const updated = await api().audits.markCategoryNotApplicable(
      audit.id,
      category,
      req,
    );
    const before = new Map(audit.items.map((i) => [i.id, previous(i)]));
    putItems(audit.id, updated);
    void refreshAudit(audit.id, audit.facilityId);
    return {
      count: updated.length,
      undo: async () => {
        const restored: AuditItem[] = [];
        for (const i of updated) {
          const req = before.get(i.id);
          // Lo que estaba pendiente vuelve a pendiente sin nota.
          if (req) restored.push(await api().items.assess(i.id, req));
        }
        putItems(audit.id, restored);
        await refreshAudit(audit.id, audit.facilityId);
      },
    };
  },
  async uploadEvidence(auditId: string, itemId: string, file: File) {
    await api().evidence.upload(
      itemId,
      file,
      crypto.randomUUID(),
      new Date().toISOString(),
    );
    await refresh(keys.audit(auditId));
  },
  async removeEvidence(auditId: string, evidenceId: string) {
    await api().evidence.remove(evidenceId);
    await refresh(keys.audit(auditId));
  },
  async close(auditId: string, facilityId: string) {
    await api().audits.close(auditId);
    await refreshAudit(auditId, facilityId);
  },
};

// ---------------------------------------------------------------------------
// Uso desde eventos de la interfaz
// ---------------------------------------------------------------------------

function report(err: unknown) {
  console.error(err);
  toast(
    err instanceof ApiError
      ? err.message
      : "No se pudo guardar el cambio. Intenta de nuevo.",
  );
}

/** Ejecuta una acción; si falla, muestra el mensaje del backend y devuelve `undefined`. */
export async function run<T>(call: Promise<T>): Promise<T | undefined> {
  try {
    return await call;
  } catch (err) {
    report(err);
    return undefined;
  }
}

/** Como `run`, pero solo dice si funcionó (para acciones sin respuesta). */
export async function attempt(call: Promise<unknown>): Promise<boolean> {
  try {
    await call;
    return true;
  } catch (err) {
    report(err);
    return false;
  }
}
