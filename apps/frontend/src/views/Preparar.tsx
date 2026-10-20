import type { Auditoria, Requisito } from "@hackaton/contracts";
import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { Icon } from "../components/Icon";
import { Crumb, instById } from "../components/ui";
import { NORMAS_CITADAS, REQ_TEMPLATES } from "../data/seed";
import { docById, temasDe } from "../domain/auditoria";
import { FRECUENCIAS, STATUS } from "../domain/constants";
import { fmtDate } from "../domain/format";
import { useAuditCtx } from "../hooks/useAuditCtx";
import { type NuevoRequisito, useAuditStore } from "../store/useAuditStore";
import { toast } from "../store/useUiStore";

const PASOS = ["Datos", "Documentos", "Pertinencias", "Requisitos"];

export function Preparar() {
  const a = useAuditCtx();
  return (
    <>
      <Crumb a={a} />
      <h2>Preparar auditoría</h2>
      <p className="muted small" style={{ margin: "0 0 10px" }}>
        {a.nombre} · antes de ir al lugar
      </p>
      <div className="steps">
        {PASOS.map((s, i) => (
          <div
            key={s}
            className={`step ${a.step === i + 1 ? "on" : a.step > i + 1 ? "done" : ""}`}
          >
            <i />
            {i + 1}. {s}
          </div>
        ))}
      </div>
      {a.step === 1 && <PasoDatos a={a} />}
      {a.step === 2 && <PasoDocs a={a} />}
      {a.step === 3 && <PasoPerts a={a} />}
      {a.step === 4 && <PasoReqs a={a} />}
    </>
  );
}

function Nav({
  a,
  atras,
  sigue,
}: {
  a: Auditoria;
  atras?: number;
  sigue?: number;
}) {
  const setStep = useAuditStore((s) => s.setStep);
  const go = (n: number) => {
    setStep(a.id, n);
    window.scrollTo(0, 0);
  };
  return (
    <div className="sticky-foot row">
      {atras && (
        <button className="btn" onClick={() => go(atras)}>
          Atrás
        </button>
      )}
      {sigue && (
        <button className="btn primary grow" onClick={() => go(sigue)}>
          Continuar
        </button>
      )}
    </div>
  );
}

function PasoDatos({ a }: { a: Auditoria }) {
  return (
    <div className="stack">
      <div className="card">
        <dl className="kv">
          <dt>Centro</dt>
          <dd>{instById(a.inst)?.nombre}</dd>
          <dt>Tipo</dt>
          <dd>{a.tipo}</dd>
          <dt>Fecha</dt>
          <dd>{fmtDate(a.fecha)}</dd>
          <dt>Estado</dt>
          <dd>
            <span className={`tag ${STATUS[a.status].cls}`}>
              {STATUS[a.status].label}
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

function PasoDocs({ a }: { a: Auditoria }) {
  const addExtraDoc = useAuditStore((s) => s.addExtraDoc);
  const docs = [...a.docs, ...a.extras];
  return (
    <div className="stack">
      <div className="card">
        <h3>Documentos de la instalación</h3>
        <p className="small muted" style={{ margin: "4px 0 12px" }}>
          RCA, resoluciones sectoriales o normas. El sistema verifica vigencia y
          si fueron modificados.
        </p>
        {docs.length ? (
          docs.map((d) => (
            <div key={d.id} className="doc">
              <span className="ico">
                <Icon name="file" />
              </span>
              <div className="grow">
                <div className="row wrap" style={{ gap: 6 }}>
                  <span className="tag">{d.tipo}</span>
                  <span className={`tag ${d.estado ?? "info"}`}>
                    {d.vigencia ?? "Por procesar"}
                  </span>
                </div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{d.numero}</div>
                <div className="small muted">
                  {d.titulo}
                  {d.fecha ? ` · ${fmtDate(d.fecha)}` : ""}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="small muted">
            Aún no hay documentos cargados para este centro.
          </div>
        )}
      </div>
      <FilePick
        accept="application/pdf,.pdf,.doc,.docx"
        onFile={(f) => {
          addExtraDoc(a.id, f.name);
          toast("Documento cargado");
        }}
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

function PasoPerts({ a }: { a: Auditoria }) {
  const loadPert = useAuditStore((s) => s.loadPert);
  const addPert = useAuditStore((s) => s.addPert);
  return (
    <div className="stack">
      <div className="card">
        <h3>Pertinencias</h3>
        <p className="small muted" style={{ margin: "4px 0 12px" }}>
          Normas adicionales que el centro debe cumplir. Cada centro está
          asociado al SEIA, donde están sus pertinencias.
        </p>
        {a.perts.length ? (
          a.perts.map((p) => (
            <div key={p.id} className="doc">
              <span className="ico">
                <Icon name="file" />
              </span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{p.numero}</div>
                <div className="small muted">{p.titulo} · citada en la RCA</div>
              </div>
              {p.cargada ? (
                <span className="tag ok">Cargada</span>
              ) : (
                <button
                  className="btn sm"
                  onClick={() => {
                    loadPert(a.id, p.id);
                    toast("Pertinencia cargada");
                  }}
                >
                  Cargar
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="small muted">Sin pertinencias registradas.</div>
        )}
      </div>
      <FilePick
        accept="application/pdf,.pdf"
        onFile={(f) => addPert(a.id, f.name)}
      >
        <Icon name="clip" />
        <br />
        <b>Agregar otra pertinencia</b>
      </FilePick>
      {a.inst === "aucha" && (
        <div className="card">
          <h3>Normas citadas detectadas</h3>
          <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
            {NORMAS_CITADAS.map((n) => (
              <span key={n} className="chip">
                {n}
              </span>
            ))}
          </div>
        </div>
      )}
      <Nav a={a} atras={2} sigue={4} />
    </div>
  );
}

/** Generación simulada: muestra el avance y luego carga los requisitos de ejemplo. */
function Generar({ a }: { a: Auditoria }) {
  const finish = useAuditStore((s) => s.finishGenerate);
  const [lines, setLines] = useState<string[] | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const start = () => {
    const n = a.docs.length + a.extras.length;
    const plan =
      a.inst === "aucha"
        ? [
            `Leyendo ${docById("D1", a).numero} (141 páginas)…`,
            "Aplicando rectificación del 19-12-2024 (33 considerandos)…",
            `Leyendo ${docById("D3", a).numero} y ${docById("D4", a).numero}…`,
            "Identificando obligaciones, frecuencias y evidencias…",
            "Cruzando documentos: 1 inconsistencia encontrada (superficie RESPEL)",
            `${REQ_TEMPLATES.length} requisitos propuestos en ${temasDe(REQ_TEMPLATES).length} temáticas ✓`,
          ]
        : [
            n
              ? `Leyendo ${n} documento${n > 1 ? "s" : ""}…`
              : "No hay documentos cargados.",
            "En el prototipo solo se procesan los documentos reales de Piscicultura Aucha.",
            "0 requisitos detectados: agrégalos manualmente.",
          ];
    setLines([]);
    timers.current = plan.map((l, i) =>
      setTimeout(() => setLines((prev) => [...(prev ?? []), l]), 450 * (i + 1)),
    );
    timers.current.push(
      setTimeout(() => finish(a.id), 450 * plan.length + 650),
    );
  };

  return (
    <div className="stack">
      <div className="card">
        <h3>Generar listado de requisitos</h3>
        <p className="small muted" style={{ margin: "4px 0 12px" }}>
          Se leerán {a.docs.length + a.extras.length} documentos y{" "}
          {a.perts.filter((p) => p.cargada).length} pertinencias para
          identificar las obligaciones aplicables.
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
        <button
          className="btn"
          onClick={() => useAuditStore.getState().setStep(a.id, 3)}
        >
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

function PasoReqs({ a }: { a: Auditoria }) {
  const navigate = useNavigate();
  const s = useAuditStore();
  if (!a.generado) return <Generar a={a} />;

  const temas = temasDe(a.reqs);
  const sel = a.reqs.filter(
    (r) => r.val !== "descartado" && !a.temasOff.includes(r.tema),
  );
  const published = a.status === "publicada" || a.status === "cerrada";

  const publicar = () => {
    if (!published) {
      s.publish(a.id);
      toast("Auditoría publicada. Ya está disponible en terreno.");
    }
    void navigate("../terreno");
  };

  return (
    <div className="stack">
      {!a.reqs.length && (
        <div className="alert warn">
          <div>
            <b>No se detectaron requisitos</b>Los documentos de este centro no
            se pudieron procesar en el prototipo. Agrega los requisitos
            manualmente.
          </div>
        </div>
      )}
      <div className="alert info">
        <div>
          <b>Validación obligatoria</b>Los requisitos generados automáticamente
          deben ser revisados por un responsable antes de usarse en la
          auditoría.
        </div>
      </div>
      <div className="card">
        <h3>Temáticas de la auditoría</h3>
        <p className="small muted" style={{ margin: "4px 0 10px" }}>
          Elige qué temáticas forman parte de esta auditoría.
        </p>
        <div className="row wrap" style={{ gap: 6 }}>
          {temas.map((t) => (
            <button
              key={t}
              className={`chip ${a.temasOff.includes(t) ? "" : "on"}`}
              onClick={() => s.toggleTema(a.id, t)}
            >
              {t} ·{" "}
              {
                a.reqs.filter((r) => r.tema === t && r.val !== "descartado")
                  .length
              }
            </button>
          ))}
        </div>
      </div>
      {s.adding ? (
        <AddReqForm a={a} temas={temas} />
      ) : (
        <button className="btn block" onClick={() => s.setAdding(true)}>
          + Agregar requisito que no detectó el análisis
        </button>
      )}
      {temas
        .filter((t) => !a.temasOff.includes(t))
        .map((t) => (
          <div key={t}>
            <div className="sec-title">{t}</div>
            {a.reqs
              .filter((r) => r.tema === t)
              .map((r) => (
                <ReqValidacion key={r.id} a={a} r={r} />
              ))}
          </div>
        ))}
      {!s.adding && (
        <div className="card sticky-foot stack">
          {published ? (
            <div className="small">
              <b>Auditoría publicada</b> por {a.validador} el{" "}
              {fmtDate(a.publicada)}. Los cambios aquí se reflejan en terreno.
            </div>
          ) : (
            <>
              <label className="small" htmlFor="validador">
                <b>Responsable que valida</b>
              </label>
              <input
                type="text"
                id="validador"
                placeholder="Nombre y cargo"
                value={a.validador}
                onChange={(e) => s.setValidador(a.id, e.target.value)}
              />
            </>
          )}
          <button
            className="btn primary block"
            disabled={!published && !(a.validador.trim() && sel.length)}
            onClick={publicar}
          >
            {published
              ? "Ir a terreno"
              : `Validar y publicar (${sel.length} requisitos)`}
          </button>
        </div>
      )}
    </div>
  );
}

function ReqValidacion({ a, r }: { a: Auditoria; r: Requisito }) {
  const s = useAuditStore();
  const [editing, setEditing] = useState(false);
  const [titulo, setTitulo] = useState(r.titulo);
  const [detalle, setDetalle] = useState(r.detalle);
  const d = docById(r.fuente.doc, a);

  if (editing) {
    return (
      <div className="req stack">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <textarea
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
        />
        <div className="row">
          <button className="btn sm" onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <button
            className="btn sm primary"
            onClick={() => {
              s.editReq(a.id, r.id, titulo, detalle);
              setEditing(false);
            }}
          >
            Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`req ${r.val === "descartado" ? "off" : ""}`}>
      <div className="t">{r.titulo}</div>
      <div className="small" style={{ marginTop: 2 }}>
        {r.detalle}
      </div>
      <div className="src" style={{ marginTop: 6 }}>
        {d.tipo} {d.numero} · {r.fuente.ref} · {r.frecuencia}
      </div>
      {r.rectificado && (
        <div style={{ marginTop: 6 }}>
          <span className="tag warn">Actualizado por rectificación</span>
        </div>
      )}
      {r.editado && (
        <div style={{ marginTop: 6 }}>
          <span className="tag info">Editado por responsable</span>
        </div>
      )}
      {r.manual && (
        <div style={{ marginTop: 6 }}>
          <span className="tag ok">Agregado manualmente</span>
        </div>
      )}
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        {r.val === "descartado" ? (
          <button className="btn sm" onClick={() => s.restoreReq(a.id, r.id)}>
            Restaurar
          </button>
        ) : (
          <>
            <button
              className="btn sm"
              onClick={() => {
                setTitulo(r.titulo);
                setDetalle(r.detalle);
                setEditing(true);
              }}
            >
              Editar
            </button>
            <button className="btn sm" onClick={() => s.discardReq(a.id, r.id)}>
              Descartar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const VACIO: NuevoRequisito = {
  tema: "",
  titulo: "",
  detalle: "",
  doc: "",
  ref: "",
  frecuencia: FRECUENCIAS[0],
  venc: "",
  evidencia: "",
};

function AddReqForm({ a, temas }: { a: Auditoria; temas: string[] }) {
  const navigate = useNavigate();
  const addReq = useAuditStore((s) => s.addReq);
  const setAdding = useAuditStore((s) => s.setAdding);
  const fuentes = [...a.docs, ...a.extras, ...a.perts.filter((p) => p.cargada)];
  const [f, setF] = useState<NuevoRequisito>({
    ...VACIO,
    doc: fuentes[0]?.id ?? "MANUAL",
  });
  const ref = useRef<HTMLDivElement>(null);
  const temaRef = useRef<HTMLInputElement>(null);
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
    temaRef.current?.focus();
  }, []);

  const guardar = () => {
    if (!f.tema.trim() || !f.titulo.trim()) {
      toast("Completa la temática y el requisito");
      return;
    }
    const pub = a.status === "publicada";
    const id = addReq(a.id, {
      ...f,
      tema: f.tema.trim(),
      titulo: f.titulo.trim(),
      detalle: f.detalle.trim(),
      ref: f.ref.trim(),
      evidencia: f.evidencia.trim(),
    });
    if (pub) {
      toast("Requisito agregado a la auditoría en terreno");
      void navigate(`../terreno/${id}`);
    } else {
      toast("Requisito agregado");
    }
  };

  return (
    <div className="card stack" ref={ref}>
      <h3>Nuevo requisito</h3>
      <div className="small muted" style={{ marginTop: -6 }}>
        Quedará marcado como agregado manualmente, con tu nombre en la
        trazabilidad.
      </div>
      <label className="small">
        <b>Temática *</b>
        <input
          ref={temaRef}
          type="text"
          list="temas-list"
          placeholder="Elige o escribe una nueva"
          value={f.tema}
          onChange={set("tema")}
        />
      </label>
      <datalist id="temas-list">
        {temas.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <label className="small">
        <b>Requisito *</b>
        <input
          type="text"
          placeholder="Ej: Registro de calibración del caudalímetro"
          value={f.titulo}
          onChange={set("titulo")}
        />
      </label>
      <label className="small">
        <b>Descripción</b>
        <textarea
          placeholder="Qué exige y cómo se verifica"
          value={f.detalle}
          onChange={set("detalle")}
        />
      </label>
      <label className="small">
        <b>Fuente</b>
        <select value={f.doc} onChange={set("doc")}>
          {fuentes.map((d) => (
            <option key={d.id} value={d.id}>
              {"tipo" in d && d.tipo ? `${d.tipo} ` : ""}
              {d.numero}
            </option>
          ))}
          <option value="MANUAL">
            Criterio del responsable (sin documento)
          </option>
        </select>
      </label>
      <label className="small">
        <b>Referencia</b>
        <input
          type="text"
          placeholder="Ej: Considerando 4.3.2, Tabla 3"
          value={f.ref}
          onChange={set("ref")}
        />
      </label>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <label className="small grow">
          <b>Frecuencia</b>
          <select value={f.frecuencia} onChange={set("frecuencia")}>
            {FRECUENCIAS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="small grow">
          <b>Vencimiento</b>
          <input type="date" value={f.venc} onChange={set("venc")} />
        </label>
      </div>
      <label className="small">
        <b>Evidencia esperada</b>
        <input
          type="text"
          placeholder="Ej: Foto del equipo y certificado"
          value={f.evidencia}
          onChange={set("evidencia")}
        />
      </label>
      <div className="row">
        <button className="btn" onClick={() => setAdding(false)}>
          Cancelar
        </button>
        <button className="btn primary grow" onClick={guardar}>
          Agregar requisito
        </button>
      </div>
    </div>
  );
}
