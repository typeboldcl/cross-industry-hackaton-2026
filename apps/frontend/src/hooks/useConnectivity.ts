import { useEffect, useState } from "react";
import { useAuditStore } from "../store/useAuditStore";
import { toast } from "../store/useUiStore";

/**
 * Los cambios siempre se guardan en el teléfono. Con conexión, se simula la
 * sincronización 1,5 s después del último cambio; sin conexión, quedan
 * pendientes hasta que vuelva la señal.
 */
export function useConnectivity() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const pending = useAuditStore((s) => s.pending);
  const markSynced = useAuditStore((s) => s.markSynced);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      toast("Conexión recuperada: sincronizando");
    };
    const off = () => {
      setOnline(false);
      toast("Sin conexión: los cambios se guardan en el teléfono");
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!online || !pending) return;
    const t = setTimeout(markSynced, 1500);
    return () => clearTimeout(t);
  }, [online, pending, markSynced]);

  return { online, pending };
}
