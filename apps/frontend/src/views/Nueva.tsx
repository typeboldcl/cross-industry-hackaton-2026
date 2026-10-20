import type { AuditKind } from "@hackaton/contracts";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { actions, run, useFacilityContext } from "../api";
import { Icon } from "../components/Icon";
import { QueryState } from "../components/ui";
import { today } from "../domain/format";
import {
  AUDIT_KIND_LABEL,
  FACILITY_ICON,
  FACILITY_KIND_LABEL,
} from "../domain/labels";
import { toast } from "../store/useUiStore";

const KINDS = Object.keys(AUDIT_KIND_LABEL) as AuditKind[];

export function Nueva() {
  const { centroId } = useParams();
  const navigate = useNavigate();
  const ctx = useFacilityContext(centroId);
  const [kind, setKind] = useState<AuditKind>("interna");
  const [title, setTitle] = useState(
    () =>
      `Auditoría interna ${new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" })}`,
  );
  const [plannedOn, setPlannedOn] = useState(today);
  const [saving, setSaving] = useState(false);

  const facility = ctx.data?.facility;
  if (!facility) {
    return (
      <QueryState
        isLoading={ctx.isLoading}
        error={ctx.error}
        retry={ctx.refetch}
      />
    );
  }

  const crear = async () => {
    if (!title.trim()) {
      toast("Ponle un nombre a la auditoría");
      return;
    }
    setSaving(true);
    const audit = await run(
      actions.createAudit({
        facilityId: facility.id,
        title: title.trim(),
        kind,
        plannedOn: plannedOn || today(),
      }),
    );
    setSaving(false);
    if (!audit) return;
    toast("Auditoría creada");
    void navigate(`/auditorias/${audit.id}/preparar`);
  };

  return (
    <div className="stack">
      <Link to={`/centros/${facility.id}`} className="crumb">
        <Icon name="back" size={16} /> Volver
      </Link>
      <h2>Crear nueva auditoría</h2>
      <div className="card stack">
        <div className="small">
          <b>Centro</b>
          {/* El centro viene de la pantalla anterior y no se puede cambiar aquí. */}
          <div className="locked" aria-readonly="true">
            <span className="ico" style={{ width: 32, height: 32 }}>
              <Icon name={FACILITY_ICON[facility.kind] ?? "file"} size={18} />
            </span>
            <span className="grow">
              <b>{facility.name}</b>
              <br />
              <span className="xs muted">
                {FACILITY_KIND_LABEL[facility.kind]}
              </span>
            </span>
            <span aria-label="Bloqueado">
              <Icon name="lock" size={16} />
            </span>
          </div>
        </div>
        <label className="small">
          <b>Tipo de auditoría</b>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as AuditKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {AUDIT_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="small">
          <b>Nombre</b>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="small">
          <b>Fecha programada</b>
          <input
            type="date"
            value={plannedOn}
            onChange={(e) => setPlannedOn(e.target.value)}
          />
        </label>
      </div>
      <div className="small muted">
        Después cargarás los documentos, generarás los requisitos y un
        responsable los validará.
      </div>
      <div className="row">
        <Link className="btn" to={`/centros/${facility.id}`}>
          Cancelar
        </Link>
        <button
          className="btn primary grow"
          disabled={saving}
          onClick={() => void crear()}
        >
          Crear y preparar
        </button>
      </div>
    </div>
  );
}
