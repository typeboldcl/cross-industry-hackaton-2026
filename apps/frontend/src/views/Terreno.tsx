import type { AuditDetail, AuditItem, NaReason } from "@hackaton/contracts";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { actions, attempt, run, type Undo } from "../api";
import { EvidenceButtons } from "../components/EvidenceButtons";
import { Icon } from "../components/Icon";
import {
  Crumb,
  Dot,
  DueTag,
  Empty,
  Legend,
  NumBadge,
  ProgressBar,
} from "../components/ui";
import {
  categoriesOf,
  categoryLookup,
  numberItems,
  RESULT_ORDER,
  type Row,
  sourceLabel,
  statsFromItems,
} from "../domain/audit";
import { fmtDate, pctLabel, plural } from "../domain/format";
import {
  MARKABLE,
  type MarkableResult,
  NA_REASON_LABEL,
  NA_REASONS,
  RESULT_CSS,
  RESULT_LABEL,
  RESULT_SHORT,
} from "../domain/labels";
import { useAuditCtx } from "../hooks/useAuditCtx";
import { askConfirm, type Tab, toast, useUiStore } from "../store/useUiStore";

/** Aviso con "Deshacer" (5 s) después de un cambio en terreno. */
function conDeshacer(msg: string, undo: Undo) {
  toast(
    msg,
    () => void attempt(undo()).then((ok) => ok && toast("Cambio deshecho")),
  );
}

/** Marca un ítem desde la lista y ofrece deshacerlo. */
async function evaluar(label: string, item: AuditItem, call: Promise<Undo>) {
  const undo = await run(call);
  if (!undo) return;
  const t = item.version.title;
  conDeshacer(`${label} · ${t.length > 28 ? `${t.slice(0, 28)}…` : t}`, undo);
}

/** Panel abierto bajo una fila: motivo de N/A o nota de No cumple. */
type Picker = { id: string; tipo: "na" | "nota" } | null;

export function Terreno() {
  const { audit: a, obligations } = useAuditCtx();
  const navigate = useNavigate();
  const { tab, q, setTab, setQ, setAdding, setStep } = useUiStore();
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

  const closed = a.status === "closed";
  if (a.status !== "published" && !closed) {
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

  const { rows, categoryNumber } = numberItems(
    a.items,
    categoryLookup(obligations),
  );
  const st = statsFromItems(a.items);
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
        <div className="small muted">{a.title}</div>
      </div>
      {closed && (
        <div className="alert info">
          <div>
            <b>Auditoría cerrada el {fmtDate(a.closedAt)}</b>Solo lectura:
            puedes revisar los resultados y evidencias.
          </div>
        </div>
      )}
      <div className="card">
        <ProgressBar st={st} />
        <div className="row small" style={{ marginTop: 8 }}>
          <span className="grow muted">
            {st.filled}/{st.total} llenados
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
              ["done", `Llenados · ${st.filled}`],
              ["pend", `Pendientes · ${st.pending}`],
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
        <Lista
          a={a}
          rows={rows}
          categoryNumber={categoryNumber}
          tab={tab}
          q={q}
          picker={picker}
          setPicker={setPicker}
        />
      </div>
      {!closed && (
        <button
          className="btn block"
          onClick={() => {
            setStep(a.id, 4);
            setAdding(true);
            void navigate("../preparar");
          }}
        >
          + Agregar requisito encontrado en terreno
        </button>
      )}
    </div>
  );
}

function Lista({
  a,
  rows,
  categoryNumber,
  tab,
  q,
  picker,
  setPicker,
}: {
  a: AuditDetail;
  rows: Row[];
  categoryNumber: Record<string, number>;
  tab: Tab;
  q: string;
  picker: Picker;
  setPicker: (p: Picker) => void;
}) {
  const ro = a.status === "closed";
  const needle = q.trim().toLowerCase();
  const list = rows
    .filter(({ item }) =>
      tab === "pend"
        ? item.result === "pending"
        : tab === "done"
          ? item.result !== "pending"
          : true,
    )
    .filter(
      ({ item, category }) =>
        !needle ||
        `${item.version.title} ${category} ${item.version.body} ${sourceLabel(item.version)}`
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

  return categoriesOf(list).map((t) => {
    // Pendientes primero (para que se vean), luego Cumple, No cumple y al final N/A.
    const group = list
      .filter((r) => r.category === t)
      .sort(
        (x, y) =>
          RESULT_ORDER[x.item.result] - RESULT_ORDER[y.item.result] ||
          x.item.position - y.item.position,
      );
    const pend = group.filter((r) => r.item.result === "pending").length;
    const totalTema = rows.filter((r) => r.category === t).length;
    return (
      <details key={t} className="group" open>
        <summary>
          <span className="t-num">{categoryNumber[t]}</span>
          {t}
          {tab !== "done" && !ro && pend > 1 && (
            <button
              className="tema-na"
              onClick={(e) => {
                e.preventDefault();
                askConfirm({
                  titulo: `¿“${t}” no aplica?`,
                  texto: `Se marcarán los ${totalTema} requisitos de esta temática como No aplica, con el motivo “${NA_REASON_LABEL.activity_not_performed}”. Podrás cambiar cada uno después.`,
                  ok: "Marcar No aplica",
                  onOk: () =>
                    void run(
                      actions.categoryNotApplicable(a, t, {
                        naReason: "activity_not_performed",
                      }),
                    ).then(
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
              ? `${group.length - pend}/${group.length}`
              : group.length}
          </span>
        </summary>
        {group.map((r) =>
          r.item.result === "pending" ? (
            <FilaPendiente
              key={r.item.id}
              a={a}
              r={r}
              ro={ro}
              picker={picker?.id === r.item.id ? picker.tipo : null}
              setPicker={setPicker}
            />
          ) : (
            <TarjetaMarcada key={r.item.id} r={r} />
          ),
        )}
      </details>
    );
  });
}

/** Ítem ya marcado: recuadro del color de su estado, sin botones. Se corrige en el detalle. */
function TarjetaMarcada({ r }: { r: Row }) {
  const { item } = r;
  const n = item.evidence.length;
  const nota =
    item.result === "not_applicable"
      ? item.naReason
        ? `No aplica: ${NA_REASON_LABEL[item.naReason]}${item.notes ? ` · ${item.notes}` : ""}`
        : "Falta el motivo de No aplica"
      : item.notes;
  return (
    <Link className={`item done ${RESULT_CSS[item.result]}`} to={item.id}>
      <span className="grow">
        <span className="row" style={{ gap: 8, alignItems: "flex-start" }}>
          <span className="t grow">
            <NumBadge code={r.code} />
            {item.version.title}
          </span>
          <span className="st-lbl">{RESULT_LABEL[item.result]}</span>
        </span>
        <span className="src">
          {[item.version.frequency, sourceLabel(item.version)]
            .filter(Boolean)
            .join(" · ")}
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

/** Ítem pendiente: se marca con un toque sin abrirlo. */
function FilaPendiente({
  a,
  r,
  ro,
  picker,
  setPicker,
}: {
  a: AuditDetail;
  r: Row;
  ro: boolean;
  picker: "na" | "nota" | null;
  setPicker: (p: Picker) => void;
}) {
  const navigate = useNavigate();
  const { item } = r;
  const extra = [
    item.version.frequency,
    sourceLabel(item.version),
    item.evidence.length ? plural(item.evidence.length, "evidencia") : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const tocar = (k: MarkableResult) => {
    if (k === "compliant") {
      void evaluar(
        RESULT_LABEL.compliant,
        item,
        actions.assess(a.id, a.facilityId, item, { result: "compliant" }),
      );
      return;
    }
    const tipo = k === "not_applicable" ? "na" : "nota";
    setPicker(picker === tipo ? null : { id: item.id, tipo });
  };

  const elegirMotivo = (m: NaReason) => {
    setPicker(null);
    if (m === "other") {
      // "Otro motivo" exige explicación: se completa en el detalle.
      toast("Describe el motivo en la observación y elige «Otro motivo»");
      void navigate(item.id, { state: { focoObs: true, naReason: "other" } });
      return;
    }
    void evaluar(
      RESULT_LABEL.not_applicable,
      item,
      actions.assess(a.id, a.facilityId, item, {
        result: "not_applicable",
        naReason: m,
      }),
    );
  };

  return (
    <div className="item q">
      <Link className="q-top" to={item.id}>
        <Dot result={item.result} />
        <span className="grow">
          <span className="t">
            <NumBadge code={r.code} />
            {item.version.title}
          </span>
          <br />
          <span className="src">{extra}</span>
          {item.version.dueDate && (
            <>
              <br />
              <DueTag due={item.version.dueDate} />
            </>
          )}
        </span>
        <span className="chev">
          <Icon name="chev" size={18} />
        </span>
      </Link>
      <div className="q-btns">
        {MARKABLE.map((k) => (
          <button
            key={k}
            className={RESULT_CSS[k]}
            disabled={ro}
            aria-pressed={false}
            onClick={() => tocar(k)}
          >
            <Dot result={k} />
            {RESULT_SHORT[k]}
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
            {NA_REASONS.map((m) => (
              <button key={m} onClick={() => elegirMotivo(m)}>
                {NA_REASON_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      )}
      {picker === "nota" && (
        <NotaNoCumple a={a} item={item} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}

/** No cumple exige una nota: un hallazgo sin descripción no sirve en la auditoría. La evidencia es opcional. */
function NotaNoCumple({
  a,
  item,
  onClose,
}: {
  a: AuditDetail;
  item: AuditItem;
  onClose: () => void;
}) {
  const [nota, setNota] = useState(item.notes ?? "");
  const [need, setNeed] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const n = item.evidence.length;

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
      RESULT_LABEL.non_compliant,
      item,
      actions.assess(a.id, a.facilityId, item, {
        result: "non_compliant",
        notes: t,
      }),
    );
  };

  return (
    <div className="na-pick stack">
      <div className="row small">
        <Dot result="non_compliant" />
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
        <EvidenceButtons auditId={a.id} itemId={item.id} small />
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
