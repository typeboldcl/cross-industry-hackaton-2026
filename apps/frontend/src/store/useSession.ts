import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** "demo" = backend simulado en el navegador; "http" = el backend real. */
export type ApiMode = "demo" | "http";

interface Session {
  /** Nombre de quien usa el dispositivo; va en X-Actor-Name. */
  actorName: string;
  apiMode: ApiMode;
  setActorName: (name: string) => void;
  setApiMode: (mode: ApiMode) => void;
}

/** Sin `VITE_API_URL` configurada no hay backend al que apuntar: parte en demo. */
const defaultMode: ApiMode = import.meta.env.VITE_API_URL ? "http" : "demo";

/** Preferencias de este dispositivo. No van a la API. */
export const useSession = create<Session>()(
  persist(
    (set) => ({
      actorName: "",
      apiMode: defaultMode,
      setActorName: (actorName) => set({ actorName }),
      setApiMode: (apiMode) => set({ apiMode }),
    }),
    {
      name: "auditorias-sesion",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
