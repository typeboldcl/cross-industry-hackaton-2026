import type {
  AuditDetail,
  DocumentKind,
  ObligationListItem,
} from "@hackaton/contracts";
import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { actions, attempt, run, useFacilityContext } from "../api";
import { Icon } from "../components/Icon";
import { Crumb, ProcessingBanner, QueryState } from "../components/ui";
import { categoriesOf, sourceLabel } from "../domain/audit";
import { fmtDate } from "../domain/format";
import {
  AUDIT_KIND_LABEL,
  AUDIT_STATUS,
  DOCUMENT_KIND_LABEL,
  FREQUENCIES,
  OBLIGATION_STATUS_LABEL,
} from "../domain/labels";
import { useAuditCtx } from "../hooks/useAuditCtx";
import { useSession } from "../store/useSession";
import { toast, useUiStore } from "../store/useUiStore";

const PASOS = ["Datos", "Documentos", "Pertinencias", "Requisitos"];

export function Preparar() {
  const { audit: a } = useAuditCtx();
  const saved = useUiStore((s) => s.steps[a.id]);
  const step = saved ?? (a.status === "draft" ? 2 : 4);
  return (
    <>
      <Crumb a={a} />
      <h2>Preparar auditoría</h2>
      <p className="muted small" style={{ margin: "0 0 10px" }}>
        {a.title} · antes de ir al lugar
      </p>
      <div className="steps">
        {PASOS.map((s, i) => (
          <div
            key={s}
            className={`step ${step === i + 1 ? "on" : step > i + 1 ? "done" : ""}`}
          >
            <i />
            {i + 1}. {s}
          </div>
        ))}
      </div>
      {step === 1 && <PasoDatos a={a} />}
      {step === 2 && <PasoDocs a={a} />}
      {step === 3 && <PasoPerts a={a} />}
      {step === 4 && <PasoReqs a={a} />}
    </>
  );
}

function Nav({
  a,
  atras,
  sigue,
}: {
  a: AuditDetail;
  atras?: number;
  sigue?: number;
}) {
  const setStep = useUiStore((s) => s.setStep);
  const go = (n: number) => {
    setStep(a.id, n);
    window.scrollTo(0, 0);
  };
  return (
    <div className="sticky-foot row">
      {atras !== undefined && (
        <button className="btn" onClick={() => go(atras)}>
          Atrás
        </button>
      )}
      {sigue !== undefined && (
        <button className="btn primary grow" onClick={() => go(sigue)}>
          Continuar
        </button>
      )}
    </div>
  );
}

function PasoDatos({ a }: { a: AuditDetail }) {
  const facility = useFacilityContext(a.facilityId).data?.facility;
  return (
    <div className="stack">
      <div className="card">
        <dl className="kv">
          <dt>Centro</dt>
          <dd>{facility?.name ?? "—"}</dd>
          <dt>Tipo</dt>
          <dd>{AUDIT_KIND_LABEL[a.kind]}</dd>
          <dt>Fecha</dt>
          <dd>{fmtDate(a.plannedOn)}</dd>
          <dt>Estado</dt>
          <dd>
            <span className={`tag ${AUDIT_STATUS[a.status].cls}`}>
              {AUDIT_STATUS[a.status].label}
            </span>
          </dd>
        </dl>
      </div>
      <Nav a={a} sigue={2} />
    </div>
  );
}

function FilePick({
  accept,
  onFile,
  children,
}: {
  accept: string;
  onFile: (f: File) => void;
  children: ReactNode;
}) {
  return (
    <label className="drop">
      <input
        type="file"
        accept={accept}
        className="hide"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {children}
    </label>
  );
}

const PROCESSING: Record<string, string> = {
  uploaded: "Cargado",
  queued: "En cola",
  processing: "Procesando…",
  done: "Procesado",
  failed: "Error al procesar",
};

const UPLOAD_KINDS: DocumentKind[] = [
  "rca",
  "rectificacion",
  "res_sanitaria",
  "norma",
  "otro",
];

function PasoDocs({ a }: { a: AuditDetail }) {
  const ctx = useFacilityContext(a.facilityId);
  const [kind, setKind] = useState<DocumentKind>("rca");
  const docs = (ctx.data?.documents ?? []).filter(
    (d) => d.kind !== "pertinencia",
  );
  return (
    <div className="stack">
      <ProcessingBanner facilityId={a.facilityId} />
      <div className="card">
        <h3>Documentos de la instalación</h3>
        <p className="small muted" style={{ margin: "4px 0 12px" }}>
          RCA, resoluciones sectoriales o normas. Al subir un documento, el
          sistema extrae sus requisitos y revisa su vigencia.
        </p>
        <QueryState
          isLoading={ctx.isLoading}
          error={ctx.error}
          retry={ctx.refetch}
        />
        {docs.map((d) => (
          <div key={d.id} className="doc">
            <span className="ico">
              <Icon name="file" />
            </span>
            <div className="grow">
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="tag">{DOCUMENT_KIND_LABEL[d.kind]}</span>
                <span className={`tag ${d.status}`}>
                  {d.statusNote ?? PROCESSING[d.processingStatus]}
                </span>
                {d.processingStatus !== "done" && (
                  <span className="tag">{PROCESSING[d.processingStatus]}</span>
                )}
              </div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>
                {d.number ?? d.title}
              </div>
              <div className="small muted">
                {d.number ? d.title : ""}
                {d.issuedOn ? ` · ${fmtDate(d.issuedOn)}` : ""}
              </div>
            </div>
          </div>
        ))}
        {ctx.data && !docs.length && (
          <div className="small muted">
            Aún no hay documentos cargados para este centro.
          </div>
        )}
      </div>
      <label className="small">
        <b>Tipo del documento a subir</b>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as DocumentKind)}
        >
          {UPLOAD_KINDS.map((k) => (
            <option key={k} value={k}>
              {DOCUMENT_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <FilePick
        accept="application/pdf,.pdf"
        onFile={(f) =>
          void attempt(actions.uploadDocument(a.facilityId, f, kind)).then(
            (ok) =>
              ok && toast("Documento cargado: se procesará en segundo plano"),
          )
        }
      >
        <Icon name="clip" />
        <br />
        <b>Cargar documento</b>
        <br />
        <span className="small">PDF de RCA, resolución sectorial o norma</span>
      </FilePick>
      <Nav a={a} atras={1} sigue={3} />
    </div>
  );
}

function PasoPerts({ a }: { a: AuditDetail }) {
  const ctx = useFacilityContext(a.facilityId);
  const perts = ctx.data?.pertinencias ?? [];
  return (
    <div className="stack">
      <div className="card">
        <h3>Pertinencias</h3>
        <p className="small muted" style={{ margin: "4px 0 12px" }}>
          Consultas de pertinencia al SEIA asociadas al centro. Al cargarlas,
          sus cambios se aplican a los requisitos.
        </p>
        <QueryState
          isLoading={ctx.isLoading}
          error={ctx.error}
          retry={ctx.refetch}
        />
        {ctx.data?.pertinenciasError && (
          <div className="alert warn">
            <div>
              <b>No se pudo consultar el SEIA</b>
              {ctx.data.pertinenciasError}
            </div>
          </div>
        )}
        {perts.map((p) => (
          <div key={p.id} className="doc">
            <span className="ico">
              <Icon name="file" />
            </span>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div className="small muted">
                {[p.proponent, p.state, p.submittedOn && fmtDate(p.submittedOn)]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            {p.loaded ? (
              <span className="tag ok">Cargada</span>
            ) : (
              <button
                className="btn sm"
                onClick={() =>
                  void attempt(
                    actions.importDocument(a.facilityId, {
                      url: p.url,
                      kind: "pertinencia",
                      title: p.name,
                    }),
                  ).then((ok) => ok && toast("Pertinencia cargada"))
                }
              >
                Cargar
              </button>
            )}
          </div>
        ))}
        {ctx.data && !perts.length && (
          <div className="small muted">
            Sin pertinencias registradas en el SEIA.
          </div>
        )}
      </div>
      <Nav a={a} atras={2} sigue={4} />
    </div>
  );
}

/** Pasa la auditoría a validación, con una animación de lo que hace el sistema. */
function Generar({ a }: { a: AuditDetail }) {
  const ctx = useFacilityContext(a.facilityId);
  const setStep = useUiStore((s) => s.setStep);
  const [lines, setLines] = useState<string[] | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const docs = ctx.data?.documents.length ?? 0;
  const perts = ctx.data?.pertinencias.filter((p) => p.loaded).length ?? 0;

  const start = () => {
    const plan = [
      `Revisando ${docs} documento${docs === 1 ? "" : "s"} y ${perts} pertinencia${perts === 1 ? "" : "s"}…`,
      "Reuniendo los requisitos extraídos de cada documento…",
      "Cruzando documentos y vigencias…",
      "Listo para validar ✓",
    ];
    setLines([]);
    timers.current = plan.map((l, i) =>
      setTimeout(() => setLines((prev) => [...(prev ?? []), l]), 450 * (i + 1)),
    );
    timers.current.push(
      setTimeout(
        () =>
          void run(actions.generate(a.id, a.facilityId)).then(() =>
            setLines(null),
          ),
        450 * plan.length + 400,
      ),
    );
  };

  return (
    <div className="stack">
      <ProcessingBanner facilityId={a.facilityId} />
      <div className="card">
        <h3>Generar listado de requisitos</h3>
        <p className="small muted" style={{ margin: "4px 0 12px" }}>
          Se reúnen las obligaciones que el sistema extrajo de los documentos y
          pertinencias del centro, para que un responsable las valide.
        </p>
        <div className="log">
          {lines ? (
            lines.map((l) => <div key={l}>› {l}</div>)
          ) : (
            <span className="muted">Listo para procesar.</span>
          )}
        </div>
      </div>
      <div className="sticky-foot row">
        <button className="btn" onClick={() => setStep(a.id, 3)}>
          Atrás
        </button>
        <button
          className="btn primary grow"
          disabled={lines !== null}
          onClick={start}
        >
          Generar requisitos
        </button>
      </div>
    </div>
  );
}

/** Requisitos que cuentan para validar (los reemplazados o derogados no). */
const visible = (o: ObligationListItem) =>
  o.version.status === "draft" ||
  o.version.status === "validated" ||
  o.version.status === "rejected";

function PasoReqs({ a }: { a: AuditDetail }) {
  const navigate = useNavigate();
  const { obligations } = useAuditCtx();
  const adding = useUiStore((s) => s.adding);
  const setAdding = useUiStore((s) => s.setAdding);
  const excluded = useUiStore((s) => s.excluded[a.id]) ?? a.excludedCategories;
  const toggleExcluded = useUiStore((s) => s.toggleExcluded);
  const actorName = useSession((s) => s.actorName);
  const setActorName = useSession((s) => s.setActorName);
  const [busy, setBusy] = useState(false);

  if (a.status === "draft") return <Generar a={a} />;

  const list = obligations.filter(visible);
  const categories = categoriesOf(list);
  const drafts = list.filter((o) => o.version.status === "draft");
  const selected = list.filter(
    (o) => o.version.status === "validated" && !excluded.includes(o.category),
  );
  const published = a.status === "published" || a.status === "closed";

  const validarTodos = async () => {
    setBusy(true);
    const ok = await attempt(
      actions.validate(
        drafts.map((o) => o.version.id),
        a.facilityId,
      ),
    );
    setBusy(false);
    if (ok) toast(`${drafts.length} requisitos validados`);
  };

  const publicar = async () => {
    if (!published) {
      setBusy(true);
      const ok = await attempt(actions.publish(a.id, a.facilityId, excluded));
      setBusy(false);
      if (!ok) return;
      toast("Auditoría publicada. Ya está disponible en terreno.");
    }
    void navigate("../terreno");
  };

  return (
    <div className="stack">
      <ProcessingBanner facilityId={a.facilityId} />
      {!list.length && (
        <div className="alert warn">
          <div>
            <b>Todavía no hay requisitos</b>Sube los documentos del centro (se
            procesan en segundo plano) o agrega los requisitos manualmente.
          </div>
        </div>
      )}
      <div className="alert info">
        <div>
          <b>Validación obligatoria</b>Solo los requisitos validados por un
          responsable entran a la auditoría. La validación queda en la
          instalación, así que las próximas auditorías no la repiten.
        </div>
      </div>
      {drafts.length > 0 && !published && (
        <button
          className="btn block"
          disabled={busy}
          onClick={() => void validarTodos()}
        >
          Validar todos los propuestos ({drafts.length})
        </button>
      )}
      {categories.length > 0 && (
        <div className="card">
          <h3>Temáticas de la auditoría</h3>
          <p className="small muted" style={{ margin: "4px 0 10px" }}>
            Elige qué temáticas forman parte de esta auditoría.
          </p>
          <div className="row wrap" style={{ gap: 6 }}>
            {categories.map((t) => (
              <button
                key={t}
                className={`chip ${excluded.includes(t) ? "" : "on"}`}
                disabled={published}
                onClick={() => toggleExcluded(a.id, t)}
              >
                {t} ·{" "}
                {
                  list.filter(
                    (o) => o.category === t && o.version.status === "validated",
                  ).length
                }
              </button>
            ))}
          </div>
        </div>
      )}
      {adding ? (
        <AddReqForm a={a} categories={categories} />
      ) : (
        <button className="btn block" onClick={() => setAdding(true)}>
          + Agregar requisito que no detectó el análisis
        </button>
      )}
      {categories
        .filter((t) => !excluded.includes(t))
        .map((t) => (
          <div key={t}>
            <div className="sec-title">{t}</div>
            {list
              .filter((o) => o.category === t)
              .map((o) => (
                <ReqValidacion key={o.obligationId} a={a} o={o} />
              ))}
          </div>
        ))}
      {!adding && (
        <div className="card sticky-foot stack">
          {published ? (
            <div className="small">
              <b>Auditoría publicada</b> por {a.validatedByName} el{" "}
              {fmtDate(a.publishedAt)}.
            </div>
          ) : (
            <>
              <label className="small" htmlFor="validador">
                <b>Responsable que valida y publica</b>
              </label>
              <input
                type="text"
                id="validador"
                placeholder="Nombre y cargo"
                value={actorName}
                onChange={(e) => setActorName(e.target.value)}
              />
            </>
          )}
          <button
            className="btn primary block"
            disabled={
              busy || (!published && !(actorName.trim() && selected.length))
            }
            onClick={() => void publicar()}
          >
            {published
              ? "Ir a terreno"
              : `Publicar auditoría (${selected.length} requisitos validados)`}
          </button>
        </div>
      )}
    </div>
  );
}

function ReqValidacion({ a, o }: { a: AuditDetail; o: ObligationListItem }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(o.version.title);
  const [body, setBody] = useState(o.version.body);
  const v = o.version;
  const fid = a.facilityId;
  const published = a.status === "published" || a.status === "closed";

  if (editing) {
    return (
      <div className="req stack">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="row">
          <button className="btn sm" onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <button
            className="btn sm primary"
            onClick={() =>
              void attempt(actions.editDraft(v.id, fid, { title, body })).then(
                (ok) => ok && setEditing(false),
              )
            }
          >
            Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`req ${v.status === "rejected" ? "off" : ""}`}>
      <div className="row" style={{ alignItems: "flex-start", gap: 8 }}>
        <div className="t grow">{v.title}</div>
        <span
          className={`tag ${v.status === "validated" ? "ok" : v.status === "draft" ? "warn" : ""}`}
        >
          {OBLIGATION_STATUS_LABEL[v.status]}
        </span>
      </div>
      <div className="small" style={{ marginTop: 2 }}>
        {v.body}
      </div>
      <div className="src" style={{ marginTop: 6 }}>
        {sourceLabel(v)}
        {v.frequency ? ` · ${v.frequency}` : ""} · {o.authority.code}
      </div>
      {v.amendmentNote && (
        <div style={{ marginTop: 6 }}>
          <span className="tag warn">Actualizado por rectificación</span>
        </div>
      )}
      {v.edited && (
        <div style={{ marginTop: 6 }}>
          <span className="tag info">Editado por responsable</span>
        </div>
      )}
      {o.origin === "manual" && (
        <div style={{ marginTop: 6 }}>
          <span className="tag ok">Agregado manualmente</span>
        </div>
      )}
      {!published && (
        <div className="row" style={{ marginTop: 8, gap: 6 }}>
          {v.status === "rejected" ? (
            <button
              className="btn sm"
              onClick={() => void run(actions.restore(v.id, fid))}
            >
              Restaurar
            </button>
          ) : (
            <>
              {v.status === "draft" && (
                <>
                  <button
                    className="btn sm primary"
                    onClick={() => void run(actions.validate([v.id], fid))}
                  >
                    Validar
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => {
                      setTitle(v.title);
                      setBody(v.body);
                      setEditing(true);
                    }}
                  >
                    Editar
                  </button>
                </>
              )}
              <button
                className="btn sm"
                onClick={() => void run(actions.reject(v.id, fid))}
              >
                Descartar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface NuevoRequisito {
  category: string;
  title: string;
  body: string;
  frequency: string;
  dueDate: string;
  expectedEvidence: string;
}

const VACIO: NuevoRequisito = {
  category: "",
  title: "",
  body: "",
  frequency: FREQUENCIES[0],
  dueDate: "",
  expectedEvidence: "",
};

function AddReqForm({
  a,
  categories,
}: {
  a: AuditDetail;
  categories: string[];
}) {
  const navigate = useNavigate();
  const setAdding = useUiStore((s) => s.setAdding);
  const [f, setF] = useState<NuevoRequisito>(VACIO);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const set =
    (k: keyof NuevoRequisito) =>
    (
      e: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    firstRef.current?.focus();
  }, []);

  const guardar = async () => {
    if (!f.category.trim() || !f.title.trim() || !f.body.trim()) {
      toast("Completa la temática, el requisito y la descripción");
      return;
    }
    setSaving(true);
    const item = await run(
      actions.addManualRequirement(a.id, a.facilityId, {
        category: f.category.trim(),
        title: f.title.trim(),
        body: f.body.trim(),
        frequency: f.frequency || null,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(f.dueDate) ? f.dueDate : null,
        expectedEvidence: f.expectedEvidence.trim() || null,
      }),
    );
    setSaving(false);
    if (!item) return;
    setAdding(false);
    if (a.status === "published") {
      toast("Requisito agregado a la auditoría en terreno");
      void navigate(`../terreno/${item.id}`);
    } else {
      toast("Requisito agregado y validado");
    }
  };

  return (
    <div className="card stack" ref={ref}>
      <h3>Nuevo requisito</h3>
      <div className="small muted" style={{ marginTop: -6 }}>
        Queda validado a tu nombre y marcado como agregado manualmente.
      </div>
      <label className="small">
        <b>Temática *</b>
        <input
          ref={firstRef}
          type="text"
          list="temas-list"
          placeholder="Elige o escribe una nueva"
          value={f.category}
          onChange={set("category")}
        />
      </label>
      <datalist id="temas-list">
        {categories.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <label className="small">
        <b>Requisito *</b>
        <input
          type="text"
          placeholder="Ej: Registro de calibración del caudalímetro"
          value={f.title}
          onChange={set("title")}
        />
      </label>
      <label className="small">
        <b>Descripción *</b>
        <textarea
          placeholder="Qué exige y cómo se verifica"
          value={f.body}
          onChange={set("body")}
        />
      </label>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <label className="small grow">
          <b>Frecuencia</b>
          <select value={f.frequency} onChange={set("frequency")}>
            {FREQUENCIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="small grow">
          <b>Vencimiento</b>
          <input type="date" value={f.dueDate} onChange={set("dueDate")} />
        </label>
      </div>
      <label className="small">
        <b>Evidencia esperada</b>
        <input
          type="text"
          placeholder="Ej: Foto del equipo y certificado"
          value={f.expectedEvidence}
          onChange={set("expectedEvidence")}
        />
      </label>
      <div className="row">
        <button className="btn" onClick={() => setAdding(false)}>
          Cancelar
        </button>
        <button
          className="btn primary grow"
          disabled={saving}
          onClick={() => void guardar()}
        >
          Agregar requisito
        </button>
      </div>
    </div>
  );
}
