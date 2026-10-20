import { Link } from "react-router";
import { actions, attempt, useFacilityContext } from "../api";
import {
  AlertBox,
  Crumb,
  Dot,
  DueTag,
  Legend,
  ProgressBar,
} from "../components/ui";
import {
  auditStats,
  categoriesOf,
  categoryLookup,
  numberItems,
  statsFromItems,
} from "../domain/audit";
import { fmtDate, pctColor, pctLabel } from "../domain/format";
import { AUDIT_STATUS } from "../domain/labels";
import { useAuditCtx } from "../hooks/useAuditCtx";
import { askConfirm, toast } from "../store/useUiStore";

const fila = {
  textDecoration: "none",
  color: "inherit",
  padding: "8px 0",
  borderTop: "1px solid var(--border)",
} as const;

export function Panel() {
  const { audit: a, obligations } = useAuditCtx();
  const ctx = useFacilityContext(a.facilityId).data;
  const { rows } = numberItems(a.items, categoryLookup(obligations));
  const st = statsFromItems(a.items);
  const temas = categoriesOf(rows).map((t) => ({
    t,
    s: statsFromItems(rows.filter((r) => r.category === t).map((r) => r.item)),
  }));
  const venc = a.items
    .filter((i) => i.version.dueDate && i.result !== "compliant")
    .sort((x, y) =>
      (x.version.dueDate ?? "").localeCompare(y.version.dueDate ?? ""),
    )
    .slice(0, 6);
  const hall = a.items.filter((i) => i.result === "non_compliant");
  const evidencias = a.items.reduce((n, i) => n + i.evidence.length, 0);

  return (
    <div className="stack">
      <Crumb a={a} />
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <h2>Panel de cumplimiento</h2>
          <div className="small muted">
            {ctx?.facility.name} · {a.title}
          </div>
        </div>
        <span className={`tag ${AUDIT_STATUS[a.status].cls}`}>
          {AUDIT_STATUS[a.status].label}
        </span>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="v" style={{ color: pctColor(st.pct) }}>
            {pctLabel(st.pct)}
          </div>
          <div className="l">Cumplimiento</div>
        </div>
        <div className="kpi">
          <div className="v">{st.progress}%</div>
          <div className="l">Avance de auditoría</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ color: "var(--bad)" }}>
            {st.non_compliant}
          </div>
          <div className="l">No cumple</div>
        </div>
        <div className="kpi">
          <div className="v">{evidencias}</div>
          <div className="l">Evidencias cargadas</div>
        </div>
      </div>
      {a.status === "published" && (
        <div className="card row wrap">
          <div className="grow small">
            <b>¿Terminó el trabajo en terreno?</b>
            <br />
            <span className="muted">
              Al cerrar, la auditoría queda en solo lectura dentro del historial
              del centro.
              {st.pending ? ` Quedan ${st.pending} pendientes.` : ""}
            </span>
          </div>
          <button
            className="btn sm"
            onClick={() =>
              askConfirm({
                titulo: "¿Cerrar la auditoría?",
                texto:
                  "Quedará en solo lectura dentro del historial del centro. Podrás revisar sus resultados y evidencias, pero no modificarlos.",
                ok: "Cerrar auditoría",
                onOk: () =>
                  void attempt(actions.close(a.id, a.facilityId)).then(
                    (ok) => ok && toast("Auditoría cerrada"),
                  ),
              })
            }
          >
            Cerrar auditoría
          </button>
        </div>
      )}
      {ctx && (
        <>
          <div className="sec-title">
            Historial de auditorías · {ctx.facility.name}
          </div>
          <div className="card">
            {ctx.audits.map((h) => {
              const s = auditStats(h);
              return (
                <Link
                  key={h.id}
                  className="row"
                  to={`/auditorias/${h.id}/panel`}
                  style={fila}
                >
                  <span className="grow small">
                    <b>{h.title}</b>
                    {h.id === a.id && (
                      <>
                        {" "}
                        <span className="tag info">abierta</span>
                      </>
                    )}
                    <br />
                    <span className="muted">
                      {fmtDate(h.plannedOn)} · {AUDIT_STATUS[h.status].label}
                    </span>
                  </span>
                  <span
                    className="small"
                    style={{ fontWeight: 700, color: pctColor(s.pct) }}
                  >
                    {pctLabel(s.pct)}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
      {a.items.length ? (
        <>
          <div className="sec-title">Cumplimiento por temática</div>
          <div className="card">
            {temas.map(({ t, s }) => (
              <div key={t} className="bar-row">
                <span>{t}</span>
                <ProgressBar st={s} />
                <span className="small" style={{ textAlign: "right" }}>
                  {pctLabel(s.pct)}
                </span>
              </div>
            ))}
            <Legend />
          </div>
          <div className="sec-title">Próximos vencimientos</div>
          <div className="card">
            {venc.length ? (
              venc.map((i) => (
                <Link
                  key={i.id}
                  className="row"
                  to={`../terreno/${i.id}`}
                  style={fila}
                >
                  <Dot result={i.result} />
                  <span className="grow small">
                    <b>{i.version.title}</b>
                    <br />
                    <span className="muted">{fmtDate(i.version.dueDate)}</span>
                  </span>
                  <DueTag due={i.version.dueDate} />
                </Link>
              ))
            ) : (
              <div className="small muted">Sin vencimientos próximos.</div>
            )}
          </div>
          <div className="sec-title">Hallazgos (no cumple)</div>
          <div className="card">
            {hall.length ? (
              hall.map((i) => (
                <Link
                  key={i.id}
                  className="row"
                  to={`../terreno/${i.id}`}
                  style={fila}
                >
                  <Dot result={i.result} />
                  <span className="grow small">
                    <b>{i.version.title}</b>
                    <br />
                    <span className="muted">
                      {i.notes || "Sin observación"}
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <div className="small muted">Sin hallazgos registrados.</div>
            )}
          </div>
        </>
      ) : (
        <div className="empty card">
          Esta auditoría todavía no tiene requisitos publicados.
        </div>
      )}
      {ctx && ctx.alerts.length > 0 && (
        <>
          <div className="sec-title">Alertas de documentos</div>
          {ctx.alerts.map((x) => (
            <AlertBox key={x.id} a={x} />
          ))}
        </>
      )}
    </div>
  );
}
