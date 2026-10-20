import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { Icon } from "../components/Icon";
import { instById } from "../components/ui";
import { INST_ICON, TIPOS_AUDITORIA } from "../domain/constants";
import { today } from "../domain/format";
import { useAuditStore } from "../store/useAuditStore";
import { toast } from "../store/useUiStore";

export function Nueva() {
  const { centroId } = useParams();
  const navigate = useNavigate();
  const createAudit = useAuditStore((s) => s.createAudit);
  const [tipo, setTipo] = useState(TIPOS_AUDITORIA[0]);
  const [nombre, setNombre] = useState(
    () =>
      `Auditoría interna ${new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" })}`,
  );
  const [fecha, setFecha] = useState(today);

  const inst = instById(centroId);
  if (!inst) return <Navigate to="/" replace />;

  const crear = () => {
    if (!nombre.trim()) {
      toast("Ponle un nombre a la auditoría");
      return;
    }
    const id = createAudit({
      inst: inst.id,
      nombre: nombre.trim(),
      tipo,
      fecha: fecha || today(),
    });
    toast("Auditoría creada");
    void navigate(`/auditorias/${id}/preparar`);
  };

  return (
    <div className="stack">
      <Link to={`/centros/${inst.id}`} className="crumb">
        <Icon name="back" size={16} /> Volver
      </Link>
      <h2>Crear nueva auditoría</h2>
      <div className="card stack">
        <div className="small">
          <b>Centro</b>
          {/* El centro viene de la pantalla anterior y no se puede cambiar aquí. */}
          <div className="locked" aria-readonly="true">
            <span className="ico" style={{ width: 32, height: 32 }}>
              <Icon name={INST_ICON[inst.id] ?? "file"} size={18} />
            </span>
            <span className="grow">
              <b>{inst.nombre}</b>
              <br />
              <span className="xs muted">{inst.tipo}</span>
            </span>
            <span aria-label="Bloqueado">
              <Icon name="lock" size={16} />
            </span>
          </div>
        </div>
        <label className="small">
          <b>Tipo de auditoría</b>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_AUDITORIA.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="small">
          <b>Nombre</b>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className="small">
          <b>Fecha programada</b>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
      </div>
      <div className="small muted">
        Después cargarás los documentos, generarás los requisitos y un
        responsable los validará.
      </div>
      <div className="row">
        <Link className="btn" to={`/centros/${inst.id}`}>
          Cancelar
        </Link>
        <button className="btn primary grow" onClick={crear}>
          Crear y preparar
        </button>
      </div>
    </div>
  );
}
