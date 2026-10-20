import { useEffect, useRef } from "react";
import { useUiStore } from "../store/useUiStore";

/** Aviso inferior. Con "Deshacer" dura 5 s, por si el toque en terreno fue accidental. */
export function Toaster() {
  const t = useUiStore((s) => s.toast);
  const hide = useUiStore((s) => s.hideToast);

  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(() => hide(t.id), t.undo ? 5000 : 2600);
    return () => clearTimeout(timer);
  }, [t, hide]);

  if (!t) return null;
  return (
    <div className="toast" role="status">
      {t.msg}
      {t.undo && (
        <button
          className="undo"
          onClick={() => {
            hide(t.id);
            t.undo?.();
          }}
        >
          Deshacer
        </button>
      )}
    </div>
  );
}

/** Diálogo de confirmación propio (window.confirm puede estar bloqueado). */
export function ConfirmDialog() {
  const c = useUiStore((s) => s.confirm);
  const close = useUiStore((s) => s.closeConfirm);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (c) cancelRef.current?.focus();
  }, [c]);

  if (!c) return null;
  return (
    <div
      className="sheet-bg"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dlg-t"
      >
        <h3 id="dlg-t">{c.titulo}</h3>
        <p className="small muted" style={{ margin: "8px 0 16px" }}>
          {c.texto}
        </p>
        <div className="row">
          <button ref={cancelRef} className="btn grow" onClick={close}>
            Cancelar
          </button>
          <button
            className={`btn primary grow ${c.peligro ? "danger" : ""}`}
            onClick={() => {
              close();
              c.onOk();
            }}
          >
            {c.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
