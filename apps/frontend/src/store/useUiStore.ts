import { create } from "zustand";

export interface ToastMsg {
  id: number;
  msg: string;
  /** Si existe, el aviso muestra "Deshacer" y dura más. */
  undo?: () => void;
}

export interface ConfirmReq {
  titulo: string;
  texto: string;
  ok: string;
  peligro?: boolean;
  onOk: () => void;
}

/** Pestaña de Terreno: todos, llenados o pendientes. */
export type Tab = "todos" | "done" | "pend";

interface UiState {
  toast: ToastMsg | null;
  confirm: ConfirmReq | null;
  tab: Tab;
  /** Búsqueda en Terreno. */
  q: string;
  /** Formulario "agregar requisito" abierto en Preparar. */
  adding: boolean;
  setTab: (tab: Tab) => void;
  setQ: (q: string) => void;
  setAdding: (adding: boolean) => void;
  showToast: (msg: string, undo?: () => void) => void;
  hideToast: (id: number) => void;
  askConfirm: (req: ConfirmReq) => void;
  closeConfirm: () => void;
}

let seq = 0;

/** Estado de pantalla: avisos, diálogos y filtros. Nunca va a la API. */
export const useUiStore = create<UiState>()((set) => ({
  toast: null,
  confirm: null,
  tab: "todos",
  q: "",
  adding: false,
  setTab: (tab) => set({ tab }),
  setQ: (q) => set({ q }),
  setAdding: (adding) => set({ adding }),
  showToast: (msg, undo) => set({ toast: { id: ++seq, msg, undo } }),
  hideToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : s)),
  askConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),
}));

/** Atajo para usar fuera de componentes (handlers, acciones). */
export const toast = (msg: string, undo?: () => void) =>
  useUiStore.getState().showToast(msg, undo);
export const askConfirm = (req: ConfirmReq) =>
  useUiStore.getState().askConfirm(req);
