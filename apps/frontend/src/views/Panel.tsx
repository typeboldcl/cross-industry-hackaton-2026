import { Link } from "react-router";
import {
  AlertBox,
  Crumb,
  Dot,
  DueTag,
  instById,
  Legend,
  ProgressBar,
} from "../components/ui";
import { ALERTAS } from "../data/seed";
import { activeReqs, auditsOf, stats, temasDe } from "../domain/auditoria";
import { STATUS } from "../domain/constants";
import { fmtDate, pctColor, pctLabel } from "../domain/format";
import { useAuditCtx } from "../hooks/useAuditCtx";
import { api, attempt, useAudits } from "../api";
import { askConfirm, toast } from "../store/useUiStore";

const fila = {
  textDecoration: "none",
  color: "inherit",
  padding: "8px 0",
  borderTop: "1px solid var(--border)",
} as const;

export function Panel() {
  const a = useAuditCtx();
  const audits = useAudits();
  const list = activeReqs(a);
  const st = stats(list);
  const inst = instById(a.inst);
  const temas = temasDe(list).map((t) => ({
    t,
    s: stats(list.filter((r) => r.tema === t)),
  }));
  const venc = list
    .filter((r) => r.venc && r.estado !== "cumple")
    .sort((x, y) => (x.venc ?? "").localeCompare(y.venc ?? ""))
    .slice(0, 6);
  const hall = list.filter((r) => r.estado === "no_cumple");
  const evidencias = list.reduce((n, r) => n + r.evidencias.length, 0);

  return (
    <div className="stack">
      <Crumb a={a} />
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <h2>Panel de cumplimiento</h2>
          <div className="small muted">
            {inst?.nombre} · {a.nombre}
          </div>
        </div>
        <span className={`tag ${STATUS[a.status].cls}`}>
          {STATUS[a.status].label}
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
          <div className="v">{st.avance}%</div>
          <div className="l">Avance de auditoría</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ color: "var(--bad)" }}>
            {st.no_cumple}
          </div>
          <div className="l">No cumple</div>
        </div>
        <div className="kpi">
          <div className="v">{evidencias}</div>
          <div className="l">Evidencias cargadas</div>
        </div>
      </div>
      {a.status === "publicada" && (
        <div className="card row wrap">
          <div className="grow small">
            <b>¿Terminó el trabajo en terreno?</b>
            <br />
            <span className="muted">
              Al cerrar, la auditoría queda en solo lectura dentro del historial
              del centro.
              {st.pendiente ? ` Quedan ${st.pendiente} pendientes.` : ""}
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
                  void attempt(api.audits.close(a.id)).then(
                    (ok) => ok && toast("Auditoría cerrada"),
                  ),
              })
            }
          >
            Cerrar auditoría
          </button>
        </div>
      )}
      <div className="sec-title">Historial de auditorías · {inst?.nombre}</div>
      <div className="card">
        {auditsOf(audits, a.inst).map((h) => {
          const s = stats(activeReqs(h));
          return (
            <Link
              key={h.id}
              className="row"
              to={`/auditorias/${h.id}/panel`}
              style={fila}
            >
              <span className="grow small">
                <b>{h.nombre}</b>
                {h.id === a.id && (
                  <>
                    {" "}
                    <span className="tag info">abierta</span>
                  </>
                )}
                <br />
                <span className="muted">
                  {fmtDate(h.fecha)} · {STATUS[h.status].label}
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
      {list.length ? (
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
              venc.map((r) => (
                <Link
                  key={r.id}
                  className="row"
                  to={`../terreno/${r.id}`}
                  style={fila}
                >
                  <Dot estado={r.estado} />
                  <span className="grow small">
                    <b>{r.titulo}</b>
                    <br />
                    <span className="muted">
                      {fmtDate(r.venc)} · {r.tema}
                    </span>
                  </span>
                  <DueTag venc={r.venc} />
                </Link>
              ))
            ) : (
              <div className="small muted">Sin vencimientos próximos.</div>
            )}
          </div>
          <div className="sec-title">Hallazgos (no cumple)</div>
          <div className="card">
            {hall.length ? (
              hall.map((r) => (
                <Link
                  key={r.id}
                  className="row"
                  to={`../terreno/${r.id}`}
                  style={fila}
                >
                  <Dot estado={r.estado} />
                  <span className="grow small">
                    <b>{r.titulo}</b>
                    <br />
                    <span className="muted">{r.obs || "Sin observación"}</span>
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
          Esta auditoría todavía no tiene requisitos validados.
        </div>
      )}
      {a.inst === "aucha" && (
        <>
          <div className="sec-title">Alertas de documentos</div>
          {ALERTAS.map((x) => (
            <AlertBox key={x.titulo} a={x} />
          ))}
        </>
      )}
    </div>
  );
}
