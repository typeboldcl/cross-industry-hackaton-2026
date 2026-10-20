import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { attempt, demoControls, queryClient, useFacilities } from "../api";
import { Icon } from "../components/Icon";
import { QueryState, Ring } from "../components/ui";
import { pctColor, plural } from "../domain/format";
import { FACILITY_KIND_LABEL } from "../domain/labels";
import { useSession } from "../store/useSession";
import { askConfirm, toast } from "../store/useUiStore";

export function Inicio() {
  const facilities = useFacilities();
  const demo = useSession((s) => s.apiMode === "demo");

  return (
    <div className="stack">
      <div className="hero">
        <h2>¿Qué centro vas a auditar?</h2>
        <p>Elige la instalación para ver sus auditorías o crear una nueva.</p>
      </div>
      <ActorCard />
      <QueryState
        isLoading={facilities.isLoading}
        error={facilities.error}
        retry={facilities.refetch}
      />
      {facilities.data?.map((f) => {
        const pct =
          f.summary.score == null ? null : Math.round(f.summary.score * 100);
        return (
          <Link
            key={f.id}
            className="select-card"
            to={`/centros/${f.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Ring pct={pct} color={pctColor(pct)} />
            <span className="grow">
              <b>{f.name}</b>
              <br />
              <span className="small muted">
                {FACILITY_KIND_LABEL[f.kind]} · {f.location ?? f.comuna}
              </span>
              <br />
              <span className="xs">
                {f.summary.audits
                  ? `${plural(f.summary.audits, "auditoría")}${f.summary.openAudits ? ` · ${f.summary.openAudits} en curso` : ""}`
                  : "Sin auditorías"}
              </span>
            </span>
            <span className="chev">
              <Icon name="chev" size={18} />
            </span>
          </Link>
        );
      })}
      {demo && <DemoCard />}
      <ModeSwitch />
    </div>
  );
}

/** El backend registra quién hace cada cambio (X-Actor-Name); se pide una vez. */
function ActorCard() {
  const actorName = useSession((s) => s.actorName);
  const setActorName = useSession((s) => s.setActorName);
  const [draft, setDraft] = useState(actorName);
  const [editing, setEditing] = useState(!actorName);

  if (!editing) {
    return (
      <div className="card row">
        <span className="grow small">
          Auditando como <b>{actorName}</b>
        </span>
        <button className="btn ghost sm" onClick={() => setEditing(true)}>
          Cambiar
        </button>
      </div>
    );
  }
  return (
    <div className="card stack">
      <label className="small" htmlFor="actor">
        <b>¿Quién está auditando?</b>
        <br />
        <span className="muted">
          Tu nombre y cargo quedan registrados en cada validación y resultado.
        </span>
      </label>
      <div className="row">
        <input
          id="actor"
          type="text"
          placeholder="Nombre y cargo"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="btn primary"
          disabled={!draft.trim()}
          onClick={() => {
            setActorName(draft.trim());
            setEditing(false);
          }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function DemoCard() {
  const navigate = useNavigate();
  const refresh = () => queryClient.invalidateQueries();
  return (
    <>
      {!demoControls.hasAudits() && (
        <div className="card row wrap">
          <div className="grow small">
            <b>¿Presentando?</b>
            <br />
            <span className="muted">
              Carga un ejemplo con dos auditorías de Aucha: una cerrada y otra
              en terreno.
            </span>
          </div>
          <button
            className="btn sm"
            onClick={() =>
              void attempt(demoControls.loadExample().then(refresh)).then(
                (ok) => {
                  if (!ok) return;
                  toast("Ejemplo cargado: 2 auditorías en Piscicultura Aucha");
                  void navigate("/");
                },
              )
            }
          >
            Cargar ejemplo
          </button>
        </div>
      )}
      <div className="row" style={{ justifyContent: "center" }}>
        <button
          className="btn ghost small"
          onClick={() =>
            askConfirm({
              titulo: "¿Reiniciar el modo demo?",
              texto:
                "Se borrarán las auditorías, requisitos y evidencias de ejemplo guardados en este dispositivo.",
              ok: "Borrar todo",
              peligro: true,
              onOk: () =>
                void attempt(demoControls.reset().then(refresh)).then(
                  (ok) => ok && toast("Modo demo reiniciado"),
                ),
            })
          }
        >
          Reiniciar modo demo
        </button>
      </div>
    </>
  );
}

/** Demo (datos en el navegador) o backend real. */
function ModeSwitch() {
  const apiMode = useSession((s) => s.apiMode);
  const setApiMode = useSession((s) => s.setApiMode);
  return (
    <div className="card row wrap small">
      <span className="grow">
        <b>Origen de los datos</b>
        <br />
        <span className="muted">
          {apiMode === "demo"
            ? "Modo demo: datos de ejemplo guardados en este navegador."
            : `Backend: ${import.meta.env.VITE_API_URL ?? "/api"}`}
        </span>
      </span>
      <div className="tabs">
        <button
          className={apiMode === "demo" ? "on" : ""}
          onClick={() => setApiMode("demo")}
        >
          Demo
        </button>
        <button
          className={apiMode === "http" ? "on" : ""}
          onClick={() => setApiMode("http")}
        >
          Backend
        </button>
      </div>
    </div>
  );
}
