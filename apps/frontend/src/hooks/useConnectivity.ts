import { useEffect, useState } from "react";
import { toast } from "../store/useUiStore";

/** Si el dispositivo tiene conexión. */
export function useConnectivity() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      toast("Conexión recuperada");
    };
    const off = () => {
      setOnline(false);
      toast(
        "Sin conexión: los cambios no se guardarán hasta que vuelva la señal",
      );
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}
