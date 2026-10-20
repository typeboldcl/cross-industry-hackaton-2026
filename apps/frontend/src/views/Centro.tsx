import type { AuditSummary } from "@hackaton/contracts";
import { Link, useParams } from "react-router";
import { useFacilityContext } from "../api";
import { Icon } from "../components/Icon";
import { AlertBox, ProgressBar, QueryState } from "../components/ui";
import { auditStats } from "../domain/audit";
import { fmtDate } from "../domain/format";
import {
  AUDIT_KIND_LABEL,
  AUDIT_STATUS,
  DOCUMENT_KIND_LABEL,
  FACILITY_ICON,
  FACILITY_KIND_LABEL,
} from "../domain/labels";

function AuditCard({ a }: { a: AuditSummary }) {
  const st = auditStats(a);
  const info = AUDIT_STATUS[a.status];
  const conAvance = a.status === "published" || a.status === "closed";
  return (
    <div className="card">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <h3>{a.title}</h3>
          <div className="small muted">
            {AUDIT_KIND_LABEL[a.kind]} · {fmtDate(a.plannedOn)}
            {a.validatedByName ? ` · validó ${a.validatedByName}` : ""}
          </div>
        </div>
        <span className={`tag ${info.cls}`}>{info.label}</span>
      </div>
      {conAvance ? (
        <>
          <div style={{ marginTop: 10 }}>
            <ProgressBar st={st} />
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            {st.filled}/{st.total} llenados ·{" "}
            {st.pct == null ? "sin evaluar" : `${st.pct}% cumplimiento`} ·{" "}
            {st.non_compliant} no cumple
          </div>
        </>
      ) : (
        <div className="small muted" style={{ marginTop: 8 }}>
          {a.status === "in_validation"
            ? "Requisitos por validar"
            : "Falta cargar documentos y generar requisitos"}
        </div>
      )}
      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <Link className="btn primary sm grow" to={`/auditorias/${a.id}`}>
          {info.action}
        </Link>
        {a.status === "published" && (
          <Link className="btn sm" to={`/auditorias/${a.id}/panel`}>
            Panel
          </Link>
        )}
      </div>
    </div>
  );
}

export function Centro() {
  const { centroId } = useParams();
  const ctx = useFacilityContext(centroId);

  if (!ctx.data) {
    return (
      <div className="stack">
        <Link to="/" className="crumb">
          <Icon name="back" size={16} /> Centros
        </Link>
        <QueryState
          isLoading={ctx.isLoading}
          error={ctx.error}
          retry={ctx.refetch}
        />
      </div>
    );
  }
  const { facility, documents, alerts, audits } = ctx.data;
  const enCurso = audits.filter((a) => a.status !== "closed");
  const cerradas = audits.filter((a) => a.status === "closed");

  return (
    <div className="stack">
      <Link to="/" className="crumb">
        <Icon name="back" size={16} /> Centros
      </Link>
      <div className="row">
        <span className="ico">
          <Icon name={FACILITY_ICON[facility.kind] ?? "file"} />
        </span>
        <div className="grow">
          <h2 style={{ margin: 0 }}>{facility.name}</h2>
          <div className="small muted">
            {FACILITY_KIND_LABEL[facility.kind]} ·{" "}
            {facility.location ?? facility.comuna}
          </div>
        </div>
      </div>
      <Link
        className="btn primary block"
        to="nueva"
        style={{ padding: 14, fontSize: 16 }}
      >
        + Crear nueva auditoría
      </Link>
      {!audits.length && (
        <div className="empty card">
          Este centro aún no tiene auditorías.
          <br />
          Crea la primera con el botón de arriba.
        </div>
      )}
      {enCurso.length > 0 && (
        <>
          <div className="sec-title">En curso · {enCurso.length}</div>
          {enCurso.map((a) => (
            <AuditCard key={a.id} a={a} />
          ))}
        </>
      )}
      {cerradas.length > 0 && (
        <>
          <div className="sec-title">Finalizadas · {cerradas.length}</div>
          {cerradas.map((a) => (
            <AuditCard key={a.id} a={a} />
          ))}
        </>
      )}
      <div className="sec-title">Documentos del centro</div>
      {documents.length ? (
        <div className="card small">
          {documents.map((d) => (
            <div key={d.id} className="row" style={{ padding: "4px 0" }}>
              <span className="tag">{DOCUMENT_KIND_LABEL[d.kind]}</span>
              <span className="grow">{d.number ?? d.title}</span>
              <span className={`tag ${d.status}`}>
                {d.status === "ok"
                  ? "Vigente"
                  : d.status === "warn"
                    ? "Revisar"
                    : "Info"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="alert info">
          <div>
            Este centro todavía no tiene documentos. Súbelos al preparar una
            auditoría, o agrega los requisitos manualmente.
          </div>
        </div>
      )}
      {alerts.length > 0 && (
        <>
          <div className="sec-title">Alertas detectadas en los documentos</div>
          {alerts.map((a) => (
            <AlertBox key={a.id} a={a} />
          ))}
        </>
      )}
    </div>
  );
}
