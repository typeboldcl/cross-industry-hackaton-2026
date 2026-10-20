import type { Auditoria } from "@hackaton/contracts";
import { Link, Navigate, useParams } from "react-router";
import { Icon } from "../components/Icon";
import { AlertBox, instById, ProgressBar } from "../components/ui";
import { ALERTAS, DOCS_AUCHA } from "../data/seed";
import { activeReqs, auditsOf, stats } from "../domain/auditoria";
import { INST_ICON, STATUS } from "../domain/constants";
import { fmtDate } from "../domain/format";
import { useAudits } from "../api";

function AuditCard({ a }: { a: Auditoria }) {
  const st = stats(activeReqs(a));
  const info = STATUS[a.status];
  const conAvance = a.status === "publicada" || a.status === "cerrada";
  return (
    <div className="card">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <h3>{a.nombre}</h3>
          <div className="small muted">
            {a.tipo} · {fmtDate(a.fecha)}
            {a.validador ? ` · validó ${a.validador}` : ""}
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
            {st.llenos}/{st.total} llenados ·{" "}
            {st.pct == null ? "sin evaluar" : `${st.pct}% cumplimiento`} ·{" "}
            {st.no_cumple} no cumple
          </div>
        </>
      ) : (
        <div className="small muted" style={{ marginTop: 8 }}>
          {a.status === "en_validacion"
            ? `${a.reqs.filter((r) => r.val !== "descartado").length} requisitos por validar`
            : "Falta cargar documentos y generar requisitos"}
        </div>
      )}
      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <Link className="btn primary sm grow" to={`/auditorias/${a.id}`}>
          {info.accion}
        </Link>
        {a.status === "publicada" && (
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
  const audits = useAudits();
  const i = instById(centroId);
  if (!i) return <Navigate to="/" replace />;

  const list = auditsOf(audits, i.id);
  const enCurso = list.filter((a) => a.status !== "cerrada");
  const cerradas = list.filter((a) => a.status === "cerrada");

  return (
    <div className="stack">
      <Link to="/" className="crumb">
        <Icon name="back" size={16} /> Centros
      </Link>
      <div className="row">
        <span className="ico">
          <Icon name={INST_ICON[i.id] ?? "file"} />
        </span>
        <div className="grow">
          <h2 style={{ margin: 0 }}>{i.nombre}</h2>
          <div className="small muted">
            {i.tipo} · {i.lugar}
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
      {!list.length && (
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
      {i.real ? (
        <>
          <div className="sec-title">Documentos del centro</div>
          <div className="card small">
            {DOCS_AUCHA.map((d) => (
              <div key={d.id} className="row" style={{ padding: "4px 0" }}>
                <span className="tag">{d.tipo}</span>
                <span className="grow">{d.numero}</span>
                <span className={`tag ${d.estado}`}>
                  {d.estado === "ok" ? "Vigente" : "Revisar"}
                </span>
              </div>
            ))}
          </div>
          <div className="sec-title">Alertas detectadas en los documentos</div>
          {ALERTAS.map((a) => (
            <AlertBox key={a.titulo} a={a} />
          ))}
        </>
      ) : (
        <div className="alert info">
          <div>
            Este centro usa datos de ejemplo: no tiene documentos del reto.
            Puedes crear auditorías y agregar requisitos manualmente.
          </div>
        </div>
      )}
    </div>
  );
}
