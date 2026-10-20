import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { EvidenceButtons } from "../components/EvidenceButtons";
import { Icon } from "../components/Icon";
import { Dot, DueTag, NumBadge } from "../components/ui";
import { docById, numeracion } from "../domain/auditoria";
import { ESTADOS, MARCABLES, NA_MOTIVOS, NA_OTRO } from "../domain/constants";
import { fmtDate } from "../domain/format";
import { useAuditCtx } from "../hooks/useAuditCtx";
import { api, attempt, run } from "../api";
import { toast } from "../store/useUiStore";

export function RequisitoView() {
  const { reqId } = useParams();
  // key: al pasar a otro requisito se reinicia el borrador de la observación.
  return <Detalle key={reqId} reqId={reqId} />;
}

function Detalle({ reqId }: { reqId?: string }) {
  const a = useAuditCtx();
  const { state } = useLocation() as { state: { focoObs?: boolean } | null };
  const r = a.reqs.find((x) => x.id === reqId);
  const [obs, setObsLocal] = useState(r?.obs ?? "");
  // Viene de elegir "Otro motivo" en la lista: hay que escribir el motivo.
  const [need, setNeed] = useState(!!state?.focoObs);
  const obsRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state?.focoObs) obsRef.current?.focus();
  }, [state]);

  if (!r) return <div className="empty">Requisito no encontrado.</div>;
  const ro = a.status === "cerrada";
  const d = docById(r.fuente.doc, a);
  const obligatoria = r.estado === "no_cumple" || r.naMotivo === NA_OTRO;

  const elegir = (k: (typeof MARCABLES)[number]) => {
    if (r.estado === k) {
      void attempt(api.items.assess(a.id, r.id, { estado: "pendiente" })).then(
        (ok) => ok && toast("Estado borrado"),
      );
      return;
    }
    if (k === "no_cumple" && !obs.trim()) {
      toast("Para marcar No cumple escribe primero la observación");
      setNeed(true);
      obsRef.current?.focus();
      return;
    }
    void attempt(api.items.assess(a.id, r.id, { estado: k, obs })).then(
      (ok) =>
        ok &&
        toast(
          k === "na"
            ? "Elige el motivo de No aplica"
            : `Guardado: ${ESTADOS[k]}`,
        ),
    );
  };

  const guardarObs = () => {
    if (!obs.trim() && r.estado === "no_cumple") {
      setObsLocal(r.obs);
      toast("La observación es obligatoria para No cumple");
      return;
    }
    void run(api.items.setNotes(a.id, r.id, obs));
  };

  return (
    <div className="stack">
      <Link
        to=".."
        relative="path"
        className="btn ghost"
        style={{ paddingLeft: 0 }}
      >
        <Icon name="back" size={18} /> Volver al checklist
      </Link>
      <div>
        <NumBadge code={numeracion(a).code[r.id]} />
        <span className="tag">{r.tema}</span>
        <h2 style={{ marginTop: 6 }}>{r.titulo}</h2>
        <p style={{ margin: "4px 0 0" }}>{r.detalle}</p>
      </div>
      {r.rectificado && (
        <div className="alert warn">
          <div>
            <b>Actualizado por rectificación</b>
            {r.rectificado}
          </div>
        </div>
      )}
      <div className="sec-title">¿Cumple?</div>
      <div className="status-grid">
        {MARCABLES.map((k) => (
          <button
            key={k}
            className={`st ${k} ${r.estado === k ? "on" : ""}`}
            disabled={ro}
            onClick={() => elegir(k)}
          >
            <Dot estado={k} />
            {ESTADOS[k]}
          </button>
        ))}
      </div>
      {r.estado === "na" && (
        <div className="na-pick">
          <b className="small">¿Por qué no aplica?</b>
          {!r.naMotivo && (
            <span className="small" style={{ color: "var(--bad)" }}>
              {" "}
              Falta el motivo
            </span>
          )}
          <div className="chips">
            {NA_MOTIVOS.map((m) => (
              <button
                key={m}
                className={r.naMotivo === m ? "on" : ""}
                disabled={ro}
                onClick={() =>
                  void attempt(api.items.setNaReason(a.id, r.id, m)).then(
                    (ok) => ok && toast("Motivo guardado"),
                  )
                }
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="sec-title" htmlFor="obs" style={{ display: "block" }}>
        Observación
        {obligatoria && (
          <span style={{ color: "var(--bad)" }}> * obligatoria</span>
        )}
      </label>
      <textarea
        id="obs"
        ref={obsRef}
        className={need ? "need" : ""}
        disabled={ro}
        placeholder="Describe lo observado en terreno…"
        value={obs}
        onChange={(e) => {
          setObsLocal(e.target.value);
          setNeed(false);
        }}
        onBlur={guardarObs}
      />
      <div className="sec-title">Evidencias</div>
      <div className="small muted" style={{ margin: "-4px 2px 8px" }}>
        Esperada: {r.evidencia}
      </div>
      <div className="stack">
        {r.evidencias.length ? (
          r.evidencias.map((e, i) => (
            <div key={`${e.nombre}-${i}`} className="ev">
              {e.thumb ? (
                <img src={e.thumb} alt="" />
              ) : (
                <span className="ph">
                  {(e.nombre.split(".").pop() || "DOC")
                    .toUpperCase()
                    .slice(0, 4)}
                </span>
              )}
              <div className="grow small">
                <b>{e.nombre}</b>
                <br />
                <span className="muted">
                  {fmtDate(e.fecha)} ·{" "}
                  {e.sync ? "sincronizada" : "guardada en el teléfono"}
                </span>
              </div>
              {!ro && (
                <button
                  className="btn ghost sm"
                  aria-label="Quitar"
                  onClick={() => void run(api.evidence.remove(a.id, r.id, i))}
                >
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="small muted">Sin evidencias aún.</div>
        )}
      </div>
      {!ro && (
        <div className="row">
          <EvidenceButtons aid={a.id} rid={r.id} />
        </div>
      )}
      <div className="sec-title">Información del requisito</div>
      <div className="card">
        <dl className="kv">
          <dt>Fuente</dt>
          <dd>
            {d.tipo} {d.numero}
          </dd>
          <dt>Referencia</dt>
          <dd>{r.fuente.ref}</dd>
          <dt>Frecuencia</dt>
          <dd>{r.frecuencia}</dd>
          <dt>Vencimiento</dt>
          <dd>
            {r.venc ? (
              <>
                {fmtDate(r.venc)} <DueTag venc={r.venc} />
              </>
            ) : (
              "—"
            )}
          </dd>
          <dt>Validado por</dt>
          <dd>{a.validador || "—"}</dd>
        </dl>
      </div>
      <div className="sec-title">Trazabilidad</div>
      <div className="hist">
        {[...r.hist].reverse().map((h, i) => (
          <div key={i}>
            <b>{h.a}</b>
            <br />
            <span className="muted xs">
              {new Date(h.f).toLocaleString("es-CL")} · {h.q}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
