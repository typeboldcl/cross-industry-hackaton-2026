import type {
  AuditResult,
  AuditSummary,
  FacilityAlert,
} from "@hackaton/contracts";
import { Link } from "react-router";
import { useFacilityContext } from "../api";
import type { Stats } from "../domain/audit";
import { daysTo, pctLabel } from "../domain/format";
import { RESULT_CSS } from "../domain/labels";
import { Icon } from "./Icon";

export function ProgressBar({ st }: { st: Stats }) {
  const w = (k: "compliant" | "non_compliant" | "not_applicable") =>
    st.total ? `${(st[k] / st.total) * 100}%` : "0%";
  return (
    <div className="progress" role="img" aria-label="Avance">
      <i style={{ width: w("compliant"), background: "var(--ok)" }} />
      <i style={{ width: w("non_compliant"), background: "var(--bad)" }} />
      <i style={{ width: w("not_applicable"), background: "var(--na)" }} />
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

export function DueTag({ due }: { due?: string | null }) {
  if (!due) return null;
  const d = daysTo(due);
  const cls = d < 0 ? "bad" : d <= 14 ? "warn" : "info";
  const txt =
    d < 0 ? `Vencido hace ${-d} d` : d === 0 ? "Vence hoy" : `Vence en ${d} d`;
  return <span className={`tag ${cls}`}>{txt}</span>;
}

export function AlertBox({ a }: { a: FacilityAlert }) {
  return (
    <div className={`alert ${a.kind}`} style={{ marginBottom: 8 }}>
      <div>
        <b>{a.title}</b>
        {a.text}
      </div>
    </div>
  );
}

export function Dot({ result }: { result: AuditResult }) {
  return <span className={`dot ${RESULT_CSS[result]}`} />;
}

export function NumBadge({ code }: { code?: string }) {
  return code ? <span className="i-num">{code}</span> : null;
}

/** Miga de pan hacia las auditorías del centro. */
export function Crumb({ a }: { a: Pick<AuditSummary, "facilityId"> }) {
  const ctx = useFacilityContext(a.facilityId);
  return (
    <Link to={`/centros/${a.facilityId}`} className="crumb">
      <Icon name="back" size={16} /> {ctx.data?.facility.name ?? "Centro"} ·
      auditorías
    </Link>
  );
}

export function Legend({ st }: { st?: Stats }) {
  return (
    <div className="legend" style={{ marginTop: 8 }}>
      <span>
        <i style={{ background: "var(--ok)" }} />
        Cumple{st ? ` ${st.compliant}` : ""}
      </span>
      <span>
        <i style={{ background: "var(--bad)" }} />
        No cumple{st ? ` ${st.non_compliant}` : ""}
      </span>
      <span>
        <i style={{ background: "var(--na)" }} />
        N/A{st ? ` ${st.not_applicable}` : ""}
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

/** Estado de una consulta a la API: cargando o con error (con reintentar). */
export function QueryState({
  isLoading,
  error,
  retry,
}: {
  isLoading: boolean;
  error: unknown;
  retry: () => unknown;
}) {
  if (isLoading) return <div className="empty">Cargando…</div>;
  if (!error) return null;
  return (
    <div className="empty card">
      <h3>No se pudieron cargar los datos</h3>
      <p className="small">
        {error instanceof Error ? error.message : "Error desconocido."}
      </p>
      <button className="btn" onClick={() => void retry()}>
        Reintentar
      </button>
    </div>
  );
}
