import type { Undo as UndoSync } from "../store/useAuditStore";
import { useAuditStore } from "../store/useAuditStore";
import { toEvidencia } from "../domain/evidencia";
import type { AuditApi, Undo } from "./types";

/** Acceso al store fuera de React: aquí vive el "backend" simulado. */
const store = () => useAuditStore.getState();
const asyncUndo =
  (undo: UndoSync): Undo =>
  async () => {
    undo();
  };

/**
 * Implementación de la API sobre los datos guardados en el teléfono.
 * Responde al instante y nunca falla; sirve para desarrollar y presentar sin
 * backend.
 */
export const localApi: AuditApi = {
  audits: {
    async create(input) {
      const id = store().createAudit(input);
      return store().audits.find((a) => a.id === id)!;
    },
    async setStep(auditId, step) {
      store().setStep(auditId, step);
    },
    async toggleCategory(auditId, tema) {
      store().toggleTema(auditId, tema);
    },
    async publish(auditId, validador) {
      store().setValidador(auditId, validador);
      store().publish(auditId);
    },
    async close(auditId) {
      store().closeAudit(auditId);
    },
  },
  documents: {
    async upload(auditId, file) {
      store().addExtraDoc(auditId, file.name);
    },
    async loadPertinencia(auditId, pertId) {
      store().loadPert(auditId, pertId);
    },
    async uploadPertinencia(auditId, file) {
      store().addPert(auditId, file.name);
    },
  },
  obligations: {
    async generate(auditId) {
      store().finishGenerate(auditId);
    },
    async create(auditId, input) {
      return store().addReq(auditId, input);
    },
    async edit(auditId, reqId, titulo, detalle) {
      store().editReq(auditId, reqId, titulo, detalle);
    },
    async discard(auditId, reqId) {
      store().discardReq(auditId, reqId);
    },
    async restore(auditId, reqId) {
      store().restoreReq(auditId, reqId);
    },
  },
  items: {
    async assess(auditId, reqId, { estado, obs, naMotivo }) {
      return asyncUndo(
        store().marcar(auditId, reqId, estado, { obs, naMotivo }),
      );
    },
    async categoryNotApplicable(auditId, tema) {
      const { count, undo } = store().temaNA(auditId, tema);
      return { count, undo: asyncUndo(undo) };
    },
    async setNotes(auditId, reqId, obs) {
      store().setObs(auditId, reqId, obs);
    },
    async setNaReason(auditId, reqId, motivo) {
      store().setNaMotivo(auditId, reqId, motivo);
    },
  },
  evidence: {
    async upload(auditId, reqId, file) {
      store().addEvidence(auditId, reqId, await toEvidencia(file));
    },
    async remove(auditId, reqId, index) {
      store().delEvidence(auditId, reqId, index);
    },
  },
  demo: {
    async load() {
      store().loadDemo();
    },
    async reset() {
      store().reset();
    },
  },
};
