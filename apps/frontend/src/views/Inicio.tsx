import type { Auditoria, Instalacion } from "@hackaton/contracts";
import { Link, useNavigate } from "react-router";
import { Icon } from "../components/Icon";
import { Ring } from "../components/ui";
import { INSTALACIONES } from "../data/seed";
import { activeReqs, auditsOf, stats } from "../domain/auditoria";
import { pctColor, plural } from "../domain/format";
import { useAuditStore } from "../store/useAuditStore";
import { askConfirm, toast } from "../store/useUiStore";

/** Resumen de un centro: última auditoría con requisitos (o datos ficticios si no hay). */
function resumen(i: Instalacion, audits: Auditoria[]) {
  const list = auditsOf(audits, i.id);
  const conReqs = list.find((a) => activeReqs(a).length);
  if (conReqs) return { pct: stats(activeReqs(conReqs)).pct, n: list.length };
  if (i.demo) return { pct: i.demo.pct, n: list.length, ficticio: true };
  return { pct: null, n: list.length };
}

export function Inicio() {
  const audits = useAuditStore((s) => s.audits);
  const loadDemo = useAuditStore((s) => s.loadDemo);
  const reset = useAuditStore((s) => s.reset);
  const navigate = useNavigate();

  return (
    <div className="stack">
      <div className="hero">
        <h2>¿Qué centro vas a auditar?</h2>
        <p>Elige la instalación para ver sus auditorías o crear una nueva.</p>
      </div>
      {INSTALACIONES.map((i) => {
        const s = resumen(i, audits);
        const enCurso = auditsOf(audits, i.id).filter(
          (a) => a.status !== "cerrada",
        ).length;
        return (
          <Link
            key={i.id}
            className="select-card"
            to={`/centros/${i.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Ring pct={s.pct} color={pctColor(s.pct)} />
            <span className="grow">
              <b>{i.nombre}</b>
              <br />
              <span className="small muted">
                {i.tipo} · {i.lugar}
              </span>
              <br />
              <span className="xs">
                {s.n
                  ? `${plural(s.n, "auditoría")}${enCurso ? ` · ${enCurso} en curso` : ""}`
                  : "Sin auditorías"}
                {s.ficticio ? " · datos ficticios" : ""}
              </span>
            </span>
            <span className="chev">
              <Icon name="chev" size={18} />
            </span>
          </Link>
        );
      })}
      {!audits.length && (
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
            onClick={() => {
              loadDemo();
              toast("Ejemplo cargado: 2 auditorías en Piscicultura Aucha");
              void navigate("/centros/aucha");
            }}
          >
            Cargar ejemplo
          </button>
        </div>
      )}
      <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
        <button
          className="btn ghost small"
          onClick={() =>
            askConfirm({
              titulo: "¿Reiniciar el prototipo?",
              texto:
                "Se borrarán todas las auditorías, requisitos y evidencias guardados en este dispositivo.",
              ok: "Borrar todo",
              peligro: true,
              onOk: () => {
                reset();
                toast("Prototipo reiniciado");
              },
            })
          }
        >
          Reiniciar prototipo
        </button>
      </div>
    </div>
  );
}
