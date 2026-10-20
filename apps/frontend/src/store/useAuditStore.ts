import type {
  Auditoria,
  EstadoTerreno,
  Evidencia,
  Requisito,
} from "@hackaton/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { REQ_TEMPLATES } from "../data/seed";
import { activeReqs } from "../domain/auditoria";
import { botAnswer, type MensajeChat } from "../domain/chat";
import { ESTADOS, NA_MOTIVOS } from "../domain/constants";
import { demoAudits, fromExtraido, newAudit } from "../domain/factories";
import { nowISO, today } from "../domain/format";

export type Tab = "todos" | "done" | "pend";

/** Lo que se guarda en el teléfono (localStorage) para trabajar sin conexión. */
interface Persisted {
  audits: Auditoria[];
  seq: number;
  /** Cambios guardados localmente que faltan por sincronizar. */
  pending: number;
  chat: MensajeChat[];
  tab: Tab;
}

interface Transient {
  q: string;
  /** Formulario "agregar requisito" abierto en Preparar. */
  adding: boolean;
}

export type Undo = () => void;

export interface NuevoRequisito {
  tema: string;
  titulo: string;
  detalle: string;
  doc: string;
  ref: string;
  frecuencia: string;
  venc: string;
  evidencia: string;
}

interface Actions {
  createAudit: (
    input: Pick<Auditoria, "inst" | "nombre" | "tipo" | "fecha">,
  ) => string;
  setStep: (aid: string, step: number) => void;
  loadPert: (aid: string, pid: string) => void;
  addExtraDoc: (aid: string, nombre: string) => void;
  addPert: (aid: string, nombre: string) => void;
  /** Termina la generación (simulada) de requisitos. */
  finishGenerate: (aid: string) => void;
  toggleTema: (aid: string, tema: string) => void;
  editReq: (aid: string, rid: string, titulo: string, detalle: string) => void;
  discardReq: (aid: string, rid: string) => void;
  restoreReq: (aid: string, rid: string) => void;
  addReq: (aid: string, input: NuevoRequisito) => string;
  setValidador: (aid: string, nombre: string) => void;
  publish: (aid: string) => void;
  /** Cambia el resultado en terreno y devuelve cómo deshacerlo. */
  marcar: (
    aid: string,
    rid: string,
    estado: EstadoTerreno,
    opts?: { obs?: string; naMotivo?: string; hist?: string },
  ) => Undo;
  /** Marca como No aplica todos los pendientes de una temática. */
  temaNA: (aid: string, tema: string) => { count: number; undo: Undo };
  setObs: (aid: string, rid: string, obs: string) => void;
  setNaMotivo: (aid: string, rid: string, motivo: string) => void;
  addEvidence: (aid: string, rid: string, ev: Evidencia) => void;
  delEvidence: (aid: string, rid: string, i: number) => void;
  closeAudit: (aid: string) => void;
  ask: (q: string, aid?: string) => void;
  setTab: (tab: Tab) => void;
  setQ: (q: string) => void;
  setAdding: (adding: boolean) => void;
  markSynced: () => void;
  loadDemo: () => void;
  reset: () => void;
}

export type AuditState = Persisted & Transient & Actions;

const initial = (): Persisted & Transient => ({
  audits: [],
  seq: 0,
  pending: 0,
  chat: [],
  tab: "todos",
  q: "",
  adding: false,
});

const quien = (a: Auditoria) => a.validador || "Usuario de terreno";
const addHist = (a: Auditoria, r: Requisito, texto: string, q = quien(a)) =>
  r.hist.push({ f: nowISO(), a: texto, q });

type Snap = Pick<Requisito, "id" | "estado" | "obs" | "naMotivo"> & {
  h: number;
};
const snap = (r: Requisito): Snap => ({
  id: r.id,
  estado: r.estado,
  obs: r.obs,
  naMotivo: r.naMotivo,
  h: r.hist.length,
});

export const useAuditStore = create<AuditState>()(
  persist(
    immer((set, get) => {
      /** Modifica una auditoría; `pending` suma un cambio por sincronizar. */
      const edit = (aid: string, fn: (a: Auditoria) => void, pending = false) =>
        set((s) => {
          const a = s.audits.find((x) => x.id === aid);
          if (!a) return;
          fn(a);
          if (pending) s.pending++;
        });
      const editReq = (
        aid: string,
        rid: string,
        fn: (r: Requisito, a: Auditoria) => void,
        pending = false,
      ) =>
        edit(
          aid,
          (a) => {
            const r = a.reqs.find((x) => x.id === rid);
            if (r) fn(r, a);
          },
          pending,
        );
      const restore =
        (aid: string, snaps: Snap[]): Undo =>
        () =>
          edit(
            aid,
            (a) =>
              snaps.forEach((sn) => {
                const r = a.reqs.find((x) => x.id === sn.id);
                if (!r) return;
                r.estado = sn.estado;
                r.obs = sn.obs;
                r.naMotivo = sn.naMotivo;
                r.hist.length = sn.h;
              }),
            true,
          );
      const find = (aid: string) => get().audits.find((a) => a.id === aid);

      return {
        ...initial(),

        createAudit(input) {
          const seq = get().seq + 1;
          const a = newAudit(seq, input);
          set((s) => {
            s.seq = seq;
            s.audits.push(a);
          });
          return a.id;
        },
        setStep: (aid, step) => edit(aid, (a) => void (a.step = step)),
        loadPert: (aid, pid) =>
          edit(aid, (a) => {
            const p = a.perts.find((x) => x.id === pid);
            if (p) p.cargada = true;
          }),
        addExtraDoc: (aid, nombre) =>
          edit(aid, (a) =>
            a.extras.push({
              id: `X${Date.now()}`,
              tipo: "Documento",
              numero: nombre,
              titulo: "Cargado por el usuario · se procesará al generar",
              vigencia: "Por verificar",
              estado: "info",
            }),
          ),
        addPert: (aid, nombre) =>
          edit(aid, (a) =>
            a.perts.push({
              id: `P${Date.now()}`,
              numero: nombre,
              titulo: "Pertinencia cargada por el usuario",
              cargada: true,
            }),
          ),
        finishGenerate: (aid) =>
          edit(aid, (a) => {
            // En el prototipo solo se procesan los documentos reales de Aucha.
            if (a.inst === "aucha") {
              a.reqs = [
                ...a.reqs.filter((r) => r.manual),
                ...REQ_TEMPLATES.map((t) => fromExtraido(t, a)),
              ];
            }
            a.generado = true;
            a.status = "en_validacion";
          }),
        toggleTema: (aid, tema) =>
          edit(aid, (a) => {
            a.temasOff = a.temasOff.includes(tema)
              ? a.temasOff.filter((t) => t !== tema)
              : [...a.temasOff, tema];
          }),
        editReq: (aid, rid, titulo, detalle) =>
          editReq(aid, rid, (r, a) => {
            r.titulo = titulo.trim() || r.titulo;
            r.detalle = detalle.trim() || r.detalle;
            r.editado = true;
            addHist(
              a,
              r,
              "Editado por el responsable",
              a.validador || "Responsable",
            );
          }),
        discardReq: (aid, rid) =>
          editReq(aid, rid, (r, a) => {
            r.val = "descartado";
            addHist(
              a,
              r,
              "Descartado por el responsable",
              a.validador || "Responsable",
            );
          }),
        restoreReq: (aid, rid) =>
          editReq(aid, rid, (r, a) => {
            r.val = a.status === "publicada" ? "validado" : "propuesto";
          }),
        addReq(aid, input) {
          const a = find(aid);
          if (!a) return "";
          const pub = a.status === "publicada";
          const q = a.validador || "Responsable";
          const n = a.reqs.filter((r) => r.manual).length + 1;
          const r: Requisito = {
            id: `M${String(n).padStart(2, "0")}-${Date.now().toString(36).slice(-3)}`,
            manual: true,
            tema: input.tema,
            titulo: input.titulo,
            detalle: input.detalle || "Requisito agregado por el responsable.",
            fuente: { doc: input.doc, ref: input.ref || "—" },
            frecuencia: input.frecuencia,
            evidencia: input.evidencia || "Por definir",
            venc: /^\d{4}-\d{2}-\d{2}$/.test(input.venc)
              ? input.venc
              : undefined,
            val: pub ? "validado" : "propuesto",
            estado: "pendiente",
            obs: "",
            evidencias: [],
            hist: [
              {
                f: nowISO(),
                a: "Agregado manualmente (no detectado por el análisis)",
                q,
              },
            ],
          };
          if (pub)
            r.hist.push({ f: nowISO(), a: "Validado para la auditoría", q });
          edit(
            aid,
            (x) => {
              x.temasOff = x.temasOff.filter((t) => t !== input.tema);
              x.reqs.push(r);
            },
            pub,
          );
          set((s) => void (s.adding = false));
          return r.id;
        },
        setValidador: (aid, nombre) =>
          edit(aid, (a) => void (a.validador = nombre)),
        publish: (aid) =>
          edit(
            aid,
            (a) => {
              const name = a.validador.trim();
              if (!name) return;
              a.validador = name;
              a.reqs.forEach((r) => {
                if (r.val === "descartado") return;
                if (a.temasOff.includes(r.tema)) {
                  r.val = "fuera";
                  return;
                }
                r.val = "validado";
                addHist(a, r, "Validado para la auditoría", name);
              });
              a.status = "publicada";
              a.publicada = nowISO();
            },
            true,
          ),
        marcar(aid, rid, estado, opts = {}) {
          const r0 = find(aid)?.reqs.find((x) => x.id === rid);
          if (!r0) return () => {};
          const before = snap(r0);
          editReq(
            aid,
            rid,
            (r, a) => {
              r.estado = estado;
              r.naMotivo =
                estado === "na" ? opts.naMotivo || r.naMotivo || "" : "";
              if (opts.obs != null) r.obs = opts.obs;
              addHist(
                a,
                r,
                opts.hist ??
                  (estado === "na"
                    ? `Marcado como “No aplica”${r.naMotivo ? `: ${r.naMotivo}` : ""}`
                    : estado === "pendiente"
                      ? "Estado borrado"
                      : `Marcado como “${ESTADOS[estado]}”${opts.obs ? " con nota" : ""}`),
              );
            },
            true,
          );
          return restore(aid, [before]);
        },
        temaNA(aid, tema) {
          const a0 = find(aid);
          const items = activeReqs(a0).filter(
            (r) => r.tema === tema && r.estado === "pendiente",
          );
          const before = items.map(snap);
          const ids = new Set(items.map((r) => r.id));
          edit(
            aid,
            (a) =>
              a.reqs
                .filter((r) => ids.has(r.id))
                .forEach((r) => {
                  r.estado = "na";
                  r.naMotivo = NA_MOTIVOS[0];
                  addHist(
                    a,
                    r,
                    `Marcado como “No aplica” (tema completo): ${NA_MOTIVOS[0]}`,
                  );
                }),
            true,
          );
          return { count: items.length, undo: restore(aid, before) };
        },
        setObs: (aid, rid, obs) =>
          editReq(
            aid,
            rid,
            (r, a) => {
              if (r.obs === obs) return;
              r.obs = obs;
              addHist(a, r, "Observación actualizada");
            },
            true,
          ),
        setNaMotivo: (aid, rid, motivo) =>
          editReq(
            aid,
            rid,
            (r, a) => {
              r.naMotivo = motivo;
              addHist(a, r, `Motivo de No aplica: ${motivo}`);
            },
            true,
          ),
        addEvidence: (aid, rid, ev) =>
          editReq(
            aid,
            rid,
            (r, a) => {
              r.evidencias.push(ev);
              addHist(a, r, `Evidencia agregada: ${ev.nombre}`);
            },
            true,
          ),
        delEvidence: (aid, rid, i) =>
          editReq(
            aid,
            rid,
            (r, a) => {
              r.evidencias.splice(i, 1);
              addHist(a, r, "Evidencia eliminada");
            },
            true,
          ),
        closeAudit: (aid) =>
          edit(
            aid,
            (a) => {
              a.status = "cerrada";
              a.cerrada = today();
            },
            true,
          ),
        ask(q, aid) {
          if (!q.trim()) return;
          const answer = botAnswer(q, (aid && find(aid)) || null);
          set((s) => {
            s.chat.push({ me: true, text: q }, answer);
          });
        },
        setTab: (tab) => set((s) => void (s.tab = tab)),
        setQ: (q) => set((s) => void (s.q = q)),
        setAdding: (adding) => set((s) => void (s.adding = adding)),
        markSynced: () =>
          set((s) => {
            s.audits.forEach((a) =>
              a.reqs.forEach((r) =>
                r.evidencias.forEach((e) => (e.sync = true)),
              ),
            );
            s.pending = 0;
          }),
        loadDemo: () =>
          set((s) => {
            Object.assign(s, initial());
            s.audits = demoAudits();
            s.seq = s.audits.length;
          }),
        reset: () => set((s) => void Object.assign(s, initial())),
      };
    }),
    {
      name: "auditorias-react-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): Persisted => ({
        audits: s.audits,
        seq: s.seq,
        pending: s.pending,
        chat: s.chat,
        tab: s.tab,
      }),
    },
  ),
);

/** Auditoría por id (o null), para usar dentro de componentes. */
export const useAudit = (aid: string | undefined) =>
  useAuditStore((s) => s.audits.find((a) => a.id === aid) ?? null);
