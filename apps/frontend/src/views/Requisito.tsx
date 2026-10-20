import type { AuditItem, NaReason } from "@hackaton/contracts";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { actions, attempt, run } from "../api";
import { EvidenceButtons } from "../components/EvidenceButtons";
import { Icon } from "../components/Icon";
import { Dot, DueTag, NumBadge } from "../components/ui";
import { categoryLookup, numberItems } from "../domain/audit";
import { fmtDate } from "../domain/format";
import {
  MARKABLE,
  type MarkableResult,
  NA_REASON_LABEL,
  NA_REASONS,
  RESULT_CSS,
  RESULT_LABEL,
} from "../domain/labels";
import { useAuditCtx } from "../hooks/useAuditCtx";
import { toast } from "../store/useUiStore";

export function RequisitoView() {
  const { itemId } = useParams();
  // key: al pasar a otro requisito se reinicia el borrador de la observación.
  return <Detalle key={itemId} itemId={itemId} />;
}

type NavState = { focoObs?: boolean; naReason?: NaReason } | null;

function Detalle({ itemId }: { itemId?: string }) {
  const { audit: a, obligations } = useAuditCtx();
  const { state } = useLocation() as { state: NavState };
  const item = a.items.find((x) => x.id === itemId);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [need, setNeed] = useState(!!state?.focoObs);
  // Tocó "No aplica" y está eligiendo el motivo (aún no se guarda).
  const [pickNa, setPickNa] = useState(!!state?.naReason);
  // Motivo de N/A elegido y aún no guardado ("Otro motivo" necesita la nota).
  const [naChoice, setNaChoice] = useState<NaReason | null>(
    state?.naReason ?? null,
  );
  const obsRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state?.focoObs) obsRef.current?.focus();
  }, [state]);

  if (!item) return <div className="empty">Requisito no encontrado.</div>;
  const ro = a.status === "closed";
  const v = item.version;
  const obligation = obligations.find(
    (o) => o.obligationId === item.obligationId,
  );
  const code = numberItems(a.items, categoryLookup(obligations)).rows.find(
    (r) => r.item.id === item.id,
  )?.code;
  const showNa = item.result === "not_applicable" || pickNa;
  const reason = naChoice ?? item.naReason;
  const obligatoria = item.result === "non_compliant" || reason === "other";
  // Eligió "Otro motivo" pero aún no lo guarda: falta escribir la explicación.
  const otroPendiente =
    naChoice === "other" &&
    !(item.result === "not_applicable" && item.naReason === "other");

  const assess = (req: Parameters<typeof actions.assess>[3], ok: string) =>
    void attempt(actions.assess(a.id, a.facilityId, item, req)).then((done) => {
      if (done) toast(ok);
    });

  const elegir = (k: MarkableResult) => {
    if (item.result === k) {
      assess({ result: "pending", notes: notes || null }, "Estado borrado");
      return;
    }
    if (k === "not_applicable") {
      setPickNa(true);
      setNaChoice(item.naReason ?? null);
      toast("Elige el motivo de No aplica");
      return;
    }
    setPickNa(false);
    setNaChoice(null);
    if (k === "non_compliant" && !notes.trim()) {
      toast("Para marcar No cumple escribe primero la observación");
      setNeed(true);
      obsRef.current?.focus();
      return;
    }
    assess(
      { result: k, notes: notes.trim() || null },
      `Guardado: ${RESULT_LABEL[k]}`,
    );
  };

  const elegirMotivo = (m: NaReason) => {
    setNaChoice(m);
    if (m === "other" && !notes.trim()) {
      toast("Describe el motivo en la observación");
      setNeed(true);
      obsRef.current?.focus();
      return;
    }
    assess(
      { result: "not_applicable", naReason: m, notes: notes.trim() || null },
      "Motivo guardado",
    );
  };

  const guardarObs = () => {
    if ((notes.trim() || null) === (item.notes ?? null)) return;
    if (!notes.trim() && obligatoria) {
      setNotes(item.notes ?? "");
      toast("La observación es obligatoria para este estado");
      return;
    }
    if (naChoice === "other" && item.result !== "not_applicable") {
      elegirMotivo("other");
      return;
    }
    void run(
      actions.assess(a.id, a.facilityId, item, {
        result: item.result,
        notes: notes.trim() || null,
        naReason: item.naReason,
      }),
    );
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
        <NumBadge code={code} />
        <span className="tag">{obligation?.category ?? "Requisito"}</span>
        <h2 style={{ marginTop: 6 }}>{v.title}</h2>
        <p style={{ margin: "4px 0 0" }}>{v.body}</p>
      </div>
      {v.amendmentNote && (
        <div className="alert warn">
          <div>
            <b>Actualizado por rectificación</b>
            {v.amendmentNote}
          </div>
        </div>
      )}
      <div className="sec-title">¿Cumple?</div>
      <div className="status-grid">
        {MARKABLE.map((k) => (
          <button
            key={k}
            className={`st ${RESULT_CSS[k]} ${(pickNa ? "not_applicable" : item.result) === k ? "on" : ""}`}
            disabled={ro}
            onClick={() => elegir(k)}
          >
            <Dot result={k} />
            {RESULT_LABEL[k]}
          </button>
        ))}
      </div>
      {showNa && (
        <div className="na-pick">
          <b className="small">¿Por qué no aplica?</b>
          {!reason && (
            <span className="small" style={{ color: "var(--bad)" }}>
              {" "}
              Falta el motivo
            </span>
          )}
          <div className="chips">
            {NA_REASONS.map((m) => (
              <button
                key={m}
                className={reason === m ? "on" : ""}
                disabled={ro}
                onClick={() => elegirMotivo(m)}
              >
                {NA_REASON_LABEL[m]}
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
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setNeed(false);
        }}
        onBlur={guardarObs}
      />
      {otroPendiente && !ro && (
        <button
          className="btn primary block"
          onClick={() => elegirMotivo("other")}
        >
          Guardar No aplica (Otro motivo)
        </button>
      )}
      <div className="sec-title">Evidencias</div>
      {v.expectedEvidence && (
        <div className="small muted" style={{ margin: "-4px 2px 8px" }}>
          Esperada: {v.expectedEvidence}
        </div>
      )}
      <div className="stack">
        {item.evidence.length ? (
          item.evidence.map((e) => (
            <div key={e.id} className="ev">
              {e.thumbUrl ? (
                <img src={e.thumbUrl} alt="" />
              ) : (
                <span className="ph">
                  {((e.filename ?? "").split(".").pop() || "DOC")
                    .toUpperCase()
                    .slice(0, 4)}
                </span>
              )}
              <div className="grow small">
                {e.fileUrl && e.fileUrl !== "#" ? (
                  <a href={e.fileUrl} target="_blank" rel="noreferrer">
                    <b>{e.filename ?? "Evidencia"}</b>
                  </a>
                ) : (
                  <b>{e.filename ?? "Evidencia"}</b>
                )}
                <br />
                <span className="muted">
                  {fmtDate(e.capturedAt)}
                  {e.uploadedByName ? ` · ${e.uploadedByName}` : ""}
                </span>
              </div>
              {!ro && (
                <button
                  className="btn ghost sm"
                  aria-label="Quitar"
                  onClick={() => void run(actions.removeEvidence(a.id, e.id))}
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
          <EvidenceButtons auditId={a.id} itemId={item.id} />
        </div>
      )}
      <div className="sec-title">Información del requisito</div>
      <div className="card">
        <dl className="kv">
          <dt>Fiscaliza</dt>
          <dd>{obligation?.authority.name ?? "—"}</dd>
          <dt>Frecuencia</dt>
          <dd>{v.frequency ?? "—"}</dd>
          <dt>Vencimiento</dt>
          <dd>
            {v.dueDate ? (
              <>
                {fmtDate(v.dueDate)} <DueTag due={v.dueDate} />
              </>
            ) : (
              "—"
            )}
          </dd>
          <dt>Validado por</dt>
          <dd>{v.validatedBy ?? "—"}</dd>
        </dl>
      </div>
      <div className="sec-title">Fuente</div>
      {v.sources.length ? (
        v.sources.map((s, i) => (
          <div key={i} className="card small">
            <b>{s.documentNumber ?? "Documento"}</b> · {s.sectionKey}
            {s.page ? ` · pág. ${s.page}` : ""}
            {s.quote && (
              <p className="muted" style={{ margin: "6px 0 0" }}>
                “{s.quote}”
              </p>
            )}
          </div>
        ))
      ) : (
        <div className="small muted">
          {obligation?.origin === "manual"
            ? "Agregado manualmente (criterio del responsable)."
            : "Sin fuente registrada."}
        </div>
      )}
      <div className="sec-title">Trazabilidad</div>
      <Historial item={item} />
    </div>
  );
}

/** El backend escribe el motivo de N/A como código; aquí se muestra en español. */
const legible = (summary: string) =>
  NA_REASONS.reduce((s, r) => s.replace(r, NA_REASON_LABEL[r]), summary);

/**
 * Historial que arma el backend con lo que registra cada paso (propuesto,
 * validado, publicado, evidencias, resultado). Lo más reciente arriba.
 */
function Historial({ item }: { item: AuditItem }) {
  const entries = [...(item.history ?? [])].sort((x, y) =>
    y.at.localeCompare(x.at),
  );
  if (!entries.length) return <div className="small muted">Sin registros.</div>;
  return (
    <div className="hist">
      {entries.map((e, i) => (
        <div key={i}>
          <b>{legible(e.summary)}</b>
          <br />
          <span className="muted xs">
            {new Date(e.at).toLocaleString("es-CL")} · {e.actorName}
          </span>
        </div>
      ))}
    </div>
  );
}
