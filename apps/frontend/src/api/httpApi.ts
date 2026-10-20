import { useSession } from "../store/useSession";
import { ApiError, type AuditApi } from "./types";

/** Base de la API: `VITE_API_URL` (p. ej. `http://localhost:3000/api`) o `/api`. */
const BASE = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");

/**
 * Quien hace el cambio, para la trazabilidad. El backend lo exige en
 * publicar, validar y evaluar (encabezado X-Actor-Name).
 */
function actorHeader(): Record<string, string> {
  const name = useSession.getState().actorName.trim();
  return name ? { "X-Actor-Name": encodeURIComponent(name) } : {};
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const isForm = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...actorHeader(),
        ...(body !== undefined && !isForm
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor.");
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(data, res.status));
  return data as T;
}

/** NestJS responde `{ message: string | string[] }`. */
function errorMessage(data: unknown, status: number): string {
  const message = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(" ");
  if (typeof message === "string") return message;
  return `El servidor respondió con un error (${status}).`;
}

const enc = encodeURIComponent;

export const httpApi: AuditApi = {
  facilities: {
    list: () => request("GET", "/facilities"),
    get: (id) => request("GET", `/facilities/${id}`),
    context: (id) => request("GET", `/facilities/${id}/context`),
    authorities: () => request("GET", "/authorities"),
  },
  documents: {
    upload(facilityId, file, kind, title) {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      if (title) form.append("title", title);
      return request("POST", `/facilities/${facilityId}/documents`, form);
    },
    import: (facilityId, req) =>
      request("POST", `/facilities/${facilityId}/documents/import`, req),
  },
  obligations: {
    list: (facilityId) =>
      request("GET", `/facilities/${facilityId}/obligations`),
    updateDraft: (id, req) =>
      request("PATCH", `/obligation-versions/${id}`, req),
    validate: (id) => request("POST", `/obligation-versions/${id}/validate`),
    reject: (id) => request("POST", `/obligation-versions/${id}/reject`),
    restore: (id) => request("POST", `/obligation-versions/${id}/restore`),
  },
  audits: {
    list: (facilityId) => request("GET", `/facilities/${facilityId}/audits`),
    get: (id) => request("GET", `/audits/${id}`),
    create: (req) => request("POST", "/audits", req),
    generate: (id) => request("POST", `/audits/${id}/generate`),
    publish: (id, excludedCategories) =>
      request("POST", `/audits/${id}/publish`, { excludedCategories }),
    addManualRequirement: (id, req) =>
      request("POST", `/audits/${id}/manual-requirements`, req),
    markCategoryNotApplicable: (id, category, req) =>
      request(
        "POST",
        `/audits/${id}/categories/${enc(category)}/not-applicable`,
        req,
      ),
    close: (id) => request("POST", `/audits/${id}/close`),
  },
  items: {
    assess: (id, req) => request("PATCH", `/audit-items/${id}`, req),
  },
  evidence: {
    upload(itemId, file, clientId, capturedAt) {
      const form = new FormData();
      form.append("file", file);
      form.append("clientId", clientId);
      if (capturedAt) form.append("capturedAt", capturedAt);
      return request("POST", `/audit-items/${itemId}/evidence`, form);
    },
    remove: (id) => request("DELETE", `/evidence/${id}`),
  },
};
