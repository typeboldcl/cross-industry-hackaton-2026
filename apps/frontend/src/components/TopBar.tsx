import { useEffect, useRef } from "react";
import { Link, useMatches } from "react-router";
import { useAudit, useFacilityContext } from "../api";
import { useConnectivity } from "../hooks/useConnectivity";
import { useTheme } from "../hooks/useTheme";
import { useSession } from "../store/useSession";
import { Icon } from "./Icon";

export function TopBar() {
  const ref = useRef<HTMLElement>(null);
  const { theme, toggle } = useTheme();
  const online = useConnectivity();
  const demo = useSession((s) => s.apiMode === "demo");
  const params = (useMatches().at(-1)?.params ?? {}) as Record<
    string,
    string | undefined
  >;
  const audit = useAudit(params.auditId).data;
  const facilityId = audit?.facilityId ?? params.centroId;
  const facility = useFacilityContext(facilityId).data?.facility;

  // Los filtros de Terreno y la barra lateral se pegan justo bajo esta barra.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () =>
      document.documentElement.style.setProperty(
        "--topbar-h",
        `${el.offsetHeight}px`,
      );
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sub = facility
    ? audit
      ? `${facility.name} · ${audit.title}`
      : facility.name
    : "Selecciona un centro";

  return (
    <header className="topbar" ref={ref}>
      <Link to="/" aria-label="Invermar · ir a Centros">
        <img className="brand-logo" src="./invermar-logo.png" alt="Invermar" />
      </Link>
      <span className="sep" aria-hidden="true" />
      <h1>
        <span className="ttl-l">Auditorías por instalación</span>
        <span className="ttl-s">Auditorías</span>
        <small>{sub}</small>
      </h1>
      <span
        className={`net ${online ? "" : "off"}`}
        title={
          demo ? "Datos de ejemplo guardados en este navegador" : undefined
        }
      >
        {!online ? "Sin conexión" : demo ? "Modo demo" : "En línea"}
      </span>
      <button
        className="theme-btn"
        onClick={toggle}
        aria-label={
          theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
        }
        title="Cambiar tema"
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
      </button>
    </header>
  );
}
