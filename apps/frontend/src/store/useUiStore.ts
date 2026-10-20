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

interface UiState {
  toast: ToastMsg | null;
  confirm: ConfirmReq | null;
  chatOpen: boolean;
  showToast: (msg: string, undo?: () => void) => void;
  hideToast: (id: number) => void;
  askConfirm: (req: ConfirmReq) => void;
  closeConfirm: () => void;
  setChatOpen: (open: boolean) => void;
}

let seq = 0;

/** Avisos, confirmaciones y chat: estado de pantalla que no se guarda. */
export const useUiStore = create<UiState>()((set) => ({
  toast: null,
  confirm: null,
  chatOpen: false,
  showToast: (msg, undo) => set({ toast: { id: ++seq, msg, undo } }),
  hideToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : s)),
  askConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),
  setChatOpen: (chatOpen) => set({ chatOpen }),
}));

/** Atajo para usar fuera de componentes (handlers, acciones). */
export const toast = (msg: string, undo?: () => void) =>
  useUiStore.getState().showToast(msg, undo);
export const askConfirm = (req: ConfirmReq) =>
  useUiStore.getState().askConfirm(req);
