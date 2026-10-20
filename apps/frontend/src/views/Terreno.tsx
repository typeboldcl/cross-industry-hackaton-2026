import type { Auditoria, Requisito } from "@hackaton/contracts";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { EvidenceButtons } from "../components/EvidenceButtons";
import { Icon } from "../components/Icon";
import {
  Crumb,
  Dot,
  DueTag,
  Empty,
  instById,
  Legend,
  NumBadge,
  ProgressBar,
} from "../components/ui";
import {
  activeReqs,
  docById,
  numeracion,
  ORDEN_ESTADO,
  stats,
  temasDe,
} from "../domain/auditoria";
import {
  ESTADOS,
  type EstadoMarcable,
  MARCABLES,
  NA_MOTIVOS,
  NA_OTRO,
} from "../domain/constants";
import { fmtDate, pctLabel, plural } from "../domain/format";
import { useAuditCtx } from "../hooks/useAuditCtx";
import { api, attempt, run, type Undo } from "../api";
import { askConfirm, type Tab, toast, useUiStore } from "../store/useUiStore";

/** Aviso con "Deshacer" (5 s) después de un cambio en terreno. */
function conDeshacer(msg: string, undo: Undo) {
  toast(
    msg,
    () => void attempt(undo()).then((ok) => ok && toast("Cambio deshecho")),
  );
}

/** Marca un requisito desde la lista y ofrece deshacerlo. */
async function evaluar(estado: string, r: Requisito, call: Promise<Undo>) {
  const undo = await run(call);
  if (!undo) return;
  const t = r.titulo.length > 28 ? `${r.titulo.slice(0, 28)}…` : r.titulo;
  conDeshacer(`${estado} · ${t}`, undo);
}

/** Panel abierto bajo una fila: motivo de N/A o nota de No cumple. */
type Picker = { id: string; tipo: "na" | "nota" } | null;

export function Terreno() {
  const a = useAuditCtx();
  const navigate = useNavigate();
  const { tab, q, setTab, setQ, setAdding } = useUiStore();
  const [picker, setPicker] = useState<Picker>(null);
  const filters = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // Buscador y pestañas quedan fijos bajo la barra superior al bajar.
  useEffect(() => {
    const onScroll = () => {
      const f = filters.current;
      if (!f) return;
      const top = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--topbar-h",
        ),
      );
      setStuck(window.scrollY > 0 && f.getBoundingClientRect().top <= top + 1);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closed = a.status === "cerrada";
  if (a.status !== "publicada" && !closed) {
    return (
      <>
        <Crumb a={a} />
        <Empty
          titulo="Esta auditoría aún no está publicada"
          texto="Primero prepárala: carga los documentos, genera los requisitos y valídalos."
          to="../preparar"
          accion="Preparar auditoría"
        />
      </>
    );
  }

  const st = stats(activeReqs(a));
  const cambiarTab = (t: Tab) => {
    setTab(t);
    setPicker(null);
    // Si los filtros estaban pegados arriba, vuelve al inicio de la lista.
    if (stuck && list.current && filters.current) {
      const top = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--topbar-h",
        ),
      );
      window.scrollTo(
        0,
        list.current.getBoundingClientRect().top +
          window.scrollY -
          filters.current.offsetHeight -
          top -
          4,
      );
    }
  };

  return (
    <div className="stack">
      <Crumb a={a} />
      <div>
        <h2>Trabajo en terreno</h2>
        <div className="small muted">
          {instById(a.inst)?.nombre} · {a.nombre}
        </div>
      </div>
      {closed && (
        <div className="alert info">
          <div>
            <b>Auditoría cerrada el {fmtDate(a.cerrada)}</b>Solo lectura: puedes
            revisar los resultados y evidencias.
          </div>
        </div>
      )}
      <div className="card">
        <ProgressBar st={st} />
        <div className="row small" style={{ marginTop: 8 }}>
          <span className="grow muted">
            {st.llenos}/{st.total} llenados
          </span>
          <span>
            <b>{pctLabel(st.pct)}</b> cumplimiento
          </span>
        </div>
        <Legend st={st} />
      </div>
      <div className={`filters ${stuck ? "stuck" : ""}`} ref={filters}>
        <input
          type="search"
          placeholder="Buscar requisito, tema o documento…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscador"
        />
        <div className="tabs">
          {(
            [
              ["todos", `Todos · ${st.total}`],
              ["done", `Llenados · ${st.llenos}`],
              ["pend", `Pendientes · ${st.pendiente}`],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              className={tab === t ? "on" : ""}
              onClick={() => cambiarTab(t)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div ref={list}>
        <Lista a={a} tab={tab} q={q} picker={picker} setPicker={setPicker} />
      </div>
      {!closed && (
        <button
          className="btn block"
          onClick={() =>
            void attempt(api.audits.setStep(a.id, 4)).then((ok) => {
              if (!ok) return;
              setAdding(true);
              void navigate("../preparar");
            })
          }
        >
          + Agregar requisito encontrado en terreno
        </button>
      )}
    </div>
  );
}

function Lista({
  a,
  tab,
  q,
  picker,
  setPicker,
}: {
  a: Auditoria;
  tab: Tab;
  q: string;
  picker: Picker;
  setPicker: (p: Picker) => void;
}) {
  const ro = a.status === "cerrada";
  const num = numeracion(a);
  const needle = q.trim().toLowerCase();
  const list = activeReqs(a)
    .filter((r) =>
      tab === "pend"
        ? r.estado === "pendiente"
        : tab === "done"
          ? r.estado !== "pendiente"
          : true,
    )
    .filter(
      (r) =>
        !needle ||
        `${r.titulo} ${r.tema} ${r.detalle} ${docById(r.fuente.doc, a).numero}`
          .toLowerCase()
          .includes(needle),
    );

  if (!list.length) {
    return (
      <div className="empty">
        {needle
          ? "Ningún requisito coincide con la búsqueda."
          : tab === "pend"
            ? "No hay requisitos pendientes. ¡Buen trabajo!"
            : tab === "done"
              ? "Aún no hay requisitos llenados."
              : "No hay requisitos en esta auditoría."}
      </div>
    );
  }

  return temasDe(list).map((t) => {
    // Pendientes primero (para que se vean), luego Cumple, No cumple y al final N/A.
    const items = list
      .filter((r) => r.tema === t)
      .sort(
        (x, y) =>
          ORDEN_ESTADO[x.estado] - ORDEN_ESTADO[y.estado] ||
          num.idx[x.id] - num.idx[y.id],
      );
    const pend = items.filter((r) => r.estado === "pendiente").length;
    return (
      <details key={t} className="group" open>
        <summary>
          <span className="t-num">{num.tema[t]}</span>
          {t}
          {tab !== "done" && !ro && pend > 1 && (
            <button
              className="tema-na"
              onClick={(e) => {
                e.preventDefault();
                askConfirm({
                  titulo: `¿“${t}” no aplica?`,
                  texto: `Se marcarán ${pend} requisitos pendientes como No aplica, con el motivo “${NA_MOTIVOS[0]}”. Podrás cambiar cada uno después.`,
                  ok: "Marcar No aplica",
                  onOk: () =>
                    void run(api.items.categoryNotApplicable(a.id, t)).then(
                      (res) =>
                        res &&
                        conDeshacer(
                          `${res.count} requisitos marcados No aplica`,
                          res.undo,
                        ),
                    ),
                });
              }}
            >
              Tema no aplica
            </button>
          )}
          <span className="cnt small muted">
            {tab === "todos"
              ? `${items.length - pend}/${items.length}`
              : items.length}
          </span>
        </summary>
        {items.map((r) =>
          r.estado === "pendiente" ? (
            <FilaPendiente
              key={r.id}
              a={a}
              r={r}
              code={num.code[r.id]}
              ro={ro}
              picker={picker?.id === r.id ? picker.tipo : null}
              setPicker={setPicker}
            />
          ) : (
            <TarjetaMarcada key={r.id} a={a} r={r} code={num.code[r.id]} />
          ),
        )}
      </details>
    );
  });
}

/** Requisito ya marcado: recuadro del color de su estado, sin botones. Se corrige en el detalle. */
function TarjetaMarcada({
  a,
  r,
  code,
}: {
  a: Auditoria;
  r: Requisito;
  code?: string;
}) {
  const n = r.evidencias.length;
  const nota =
    r.estado === "na"
      ? r.naMotivo
        ? `No aplica: ${r.naMotivo}`
        : "Falta el motivo de No aplica"
      : r.obs;
  return (
    <Link className={`item done ${r.estado}`} to={r.id}>
      <span className="grow">
        <span className="row" style={{ gap: 8, alignItems: "flex-start" }}>
          <span className="t grow">
            <NumBadge code={code} />
            {r.titulo}
          </span>
          <span className="st-lbl">{ESTADOS[r.estado]}</span>
        </span>
        <span className="src">
          {r.frecuencia} · {docById(r.fuente.doc, a).tipo}
          {n ? ` · ${plural(n, "evidencia")}` : ""}
        </span>
        {nota && <span className="d-note">{nota}</span>}
      </span>
      <span className="chev">
        <Icon name="chev" size={18} />
      </span>
    </Link>
  );
}

const LBL: Record<EstadoMarcable, string> = {
  cumple: "Cumple",
  no_cumple: "No cumple",
  na: "N/A",
};

/** Requisito pendiente: se marca con un toque sin abrirlo. */
function FilaPendiente({
  a,
  r,
  code,
  ro,
  picker,
  setPicker,
}: {
  a: Auditoria;
  r: Requisito;
  code?: string;
  ro: boolean;
  picker: "na" | "nota" | null;
  setPicker: (p: Picker) => void;
}) {
  const navigate = useNavigate();
  const extra = [
    r.frecuencia,
    docById(r.fuente.doc, a).tipo,
    r.evidencias.length ? plural(r.evidencias.length, "evidencia") : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const tocar = (k: EstadoMarcable) => {
    if (k === "cumple") {
      void evaluar(
        ESTADOS.cumple,
        r,
        api.items.assess(a.id, r.id, { estado: "cumple" }),
      );
      return;
    }
    const tipo = k === "na" ? "na" : "nota";
    setPicker(picker === tipo ? null : { id: r.id, tipo });
  };

  const elegirMotivo = (m: string) => {
    setPicker(null);
    const call = api.items.assess(a.id, r.id, { estado: "na", naMotivo: m });
    if (m === NA_OTRO) {
      void attempt(call).then((ok) => {
        if (!ok) return;
        toast("Describe el motivo en la observación");
        void navigate(r.id, { state: { focoObs: true } });
      });
      return;
    }
    void evaluar(ESTADOS.na, r, call);
  };

  return (
    <div className="item q">
      <Link className="q-top" to={r.id}>
        <Dot estado={r.estado} />
        <span className="grow">
          <span className="t">
            <NumBadge code={code} />
            {r.titulo}
          </span>
          <br />
          <span className="src">{extra}</span>
          {r.venc && (
            <>
              <br />
              <DueTag venc={r.venc} />
            </>
          )}
        </span>
        <span className="chev">
          <Icon name="chev" size={18} />
        </span>
      </Link>
      <div className="q-btns">
        {MARCABLES.map((k) => (
          <button
            key={k}
            className={k}
            disabled={ro}
            aria-pressed={false}
            onClick={() => tocar(k)}
          >
            <Dot estado={k} />
            {LBL[k]}
          </button>
        ))}
      </div>
      {picker === "na" && (
        <div className="na-pick">
          <div className="row small">
            <b className="grow">¿Por qué no aplica?</b>
            <button className="btn ghost sm" onClick={() => setPicker(null)}>
              Cancelar
            </button>
          </div>
          <div className="chips">
            {NA_MOTIVOS.map((m) => (
              <button key={m} onClick={() => elegirMotivo(m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
      {picker === "nota" && (
        <NotaNoCumple a={a} r={r} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}

/** No cumple exige una nota: un hallazgo sin descripción no sirve en la auditoría. La evidencia es opcional. */
function NotaNoCumple({
  a,
  r,
  onClose,
}: {
  a: Auditoria;
  r: Requisito;
  onClose: () => void;
}) {
  const [nota, setNota] = useState(r.obs);
  const [need, setNeed] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const n = r.evidencias.length;

  const guardar = () => {
    const t = nota.trim();
    if (!t) {
      toast("La nota es obligatoria para No cumple");
      setNeed(true);
      ref.current?.focus();
      return;
    }
    onClose();
    void evaluar(
      ESTADOS.no_cumple,
      r,
      api.items.assess(a.id, r.id, { estado: "no_cumple", obs: t }),
    );
  };

  return (
    <div className="na-pick stack">
      <div className="row small">
        <Dot estado="no_cumple" />
        <b className="grow">
          No cumple: ¿qué observaste?{" "}
          <span style={{ color: "var(--bad)" }}>*</span>
        </b>
      </div>
      <textarea
        ref={ref}
        rows={3}
        className={need ? "need" : ""}
        placeholder="Describe el hallazgo (obligatorio)…"
        value={nota}
        onChange={(e) => {
          setNota(e.target.value);
          setNeed(false);
        }}
      />
      <div className="row wrap small">
        <EvidenceButtons aid={a.id} rid={r.id} small />
        <span className="muted grow">
          {n ? plural(n, "evidencia") : "Evidencia opcional"}
        </span>
      </div>
      <div className="row">
        <button className="btn sm grow" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn sm primary grow" onClick={guardar}>
          Guardar No cumple
        </button>
      </div>
    </div>
  );
}
