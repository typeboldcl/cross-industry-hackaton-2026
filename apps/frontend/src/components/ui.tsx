import type { Auditoria, EstadoTerreno } from "@hackaton/contracts";
import { Link } from "react-router";
import type { Alerta } from "../data/seed";
import { INSTALACIONES } from "../data/seed";
import type { Stats } from "../domain/auditoria";
import { daysTo, pctLabel } from "../domain/format";
import { Icon } from "./Icon";

export const instById = (id: string | undefined) =>
  INSTALACIONES.find((i) => i.id === id);

export function ProgressBar({ st }: { st: Stats }) {
  const w = (k: "cumple" | "no_cumple" | "na") =>
    st.total ? `${(st[k] / st.total) * 100}%` : "0%";
  return (
    <div className="progress" role="img" aria-label="Avance">
      <i style={{ width: w("cumple"), background: "var(--ok)" }} />
      <i style={{ width: w("no_cumple"), background: "var(--bad)" }} />
      <i style={{ width: w("na"), background: "var(--na)" }} />
    </div>
  );
}

export function Ring({ pct, color }: { pct: number | null; color: string }) {
  const c = 2 * Math.PI * 26;
  return (
    <svg className="ring" viewBox="0 0 64 64">
      <circle
        cx="32"
        cy="32"
        r="26"
        fill="none"
        stroke="var(--surface-2)"
        strokeWidth="8"
      />
      <circle
        cx="32"
        cy="32"
        r="26"
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${(c * (pct ?? 0)) / 100} ${c}`}
        transform="rotate(-90 32 32)"
      />
      <text
        x="32"
        y="37"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="var(--text)"
      >
        {pctLabel(pct)}
      </text>
    </svg>
  );
}

export function DueTag({ venc }: { venc?: string }) {
  if (!venc) return null;
  const d = daysTo(venc);
  const cls = d < 0 ? "bad" : d <= 14 ? "warn" : "info";
  const txt =
    d < 0 ? `Vencido hace ${-d} d` : d === 0 ? "Vence hoy" : `Vence en ${d} d`;
  return <span className={`tag ${cls}`}>{txt}</span>;
}

export function AlertBox({ a }: { a: Alerta }) {
  return (
    <div className={`alert ${a.tipo}`} style={{ marginBottom: 8 }}>
      <div>
        <b>{a.titulo}</b>
        {a.texto}
      </div>
    </div>
  );
}

export function Dot({ estado }: { estado: EstadoTerreno }) {
  return <span className={`dot ${estado}`} />;
}

export function NumBadge({ code }: { code?: string }) {
  return code ? <span className="i-num">{code}</span> : null;
}

/** Miga de pan hacia las auditorías del centro. */
export function Crumb({ a }: { a: Auditoria }) {
  return (
    <Link to={`/centros/${a.inst}`} className="crumb">
      <Icon name="back" size={16} /> {instById(a.inst)?.nombre} · auditorías
    </Link>
  );
}

export function Legend({ st }: { st?: Stats }) {
  return (
    <div className="legend" style={{ marginTop: 8 }}>
      <span>
        <i style={{ background: "var(--ok)" }} />
        Cumple{st ? ` ${st.cumple}` : ""}
      </span>
      <span>
        <i style={{ background: "var(--bad)" }} />
        No cumple{st ? ` ${st.no_cumple}` : ""}
      </span>
      <span>
        <i style={{ background: "var(--na)" }} />
        N/A{st ? ` ${st.na}` : ""}
      </span>
      {!st && (
        <span>
          <i style={{ background: "var(--surface-2)" }} />
          Pendiente
        </span>
      )}
    </div>
  );
}

export function Empty({
  titulo,
  texto,
  to,
  accion,
}: {
  titulo: string;
  texto: string;
  to: string;
  accion: string;
}) {
  return (
    <div className="empty card">
      <h3>{titulo}</h3>
      <p className="small">{texto}</p>
      <Link className="btn primary" to={to}>
        {accion}
      </Link>
    </div>
  );
}
