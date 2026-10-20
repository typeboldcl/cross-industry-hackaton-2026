import { useEffect, useRef, useState } from "react";
import { useAuditStore } from "../store/useAuditStore";
import { useUiStore } from "../store/useUiStore";
import { Icon } from "./Icon";

const SUGERENCIAS = [
  "¿Cada cuánto se retiran los lodos?",
  "¿Cuándo vence la declaración SUSPEL?",
  "¿Qué pide la RCA sobre ruido?",
  "¿Cuánto tiempo puede estar un RESPEL en bodega?",
];

export function ChatFab({ hidden }: { hidden: boolean }) {
  const open = useUiStore((s) => s.setChatOpen);
  if (hidden) return null;
  return (
    <button
      className="fab"
      aria-label="Abrir chat de normativa"
      onClick={() => open(true)}
    >
      <Icon name="chat" size={26} />
    </button>
  );
}

/** Consulta de normativa: responde siempre citando el documento fuente. */
export function ChatSheet({ auditId }: { auditId?: string }) {
  const isOpen = useUiStore((s) => s.chatOpen);
  const setOpen = useUiStore((s) => s.setChatOpen);
  const chat = useAuditStore((s) => s.chat);
  const ask = useAuditStore((s) => s.ask);
  const [q, setQ] = useState("");
  const msgs = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    msgs.current?.scrollTo(0, msgs.current.scrollHeight);
    input.current?.focus();
  }, [isOpen, chat.length]);

  if (!isOpen) return null;
  const send = (text: string) => {
    ask(text, auditId);
    setQ("");
  };

  return (
    <div
      className="sheet-bg"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="sheet" role="dialog" aria-label="Chat de normativa">
        <header>
          <div className="grow">
            <b>Consulta la normativa</b>
            <div className="xs muted">
              Respuestas basadas en los documentos de la instalación · demo
            </div>
          </div>
          <button
            className="btn ghost sm"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          >
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="msgs" ref={msgs}>
          {!chat.length && (
            <div className="msg bot">
              Hola. Pregúntame qué exige la RCA o las resoluciones para esta
              instalación. Siempre te indico la fuente.
            </div>
          )}
          {chat.map((m, i) => (
            <div key={i} className={`msg ${m.me ? "me" : "bot"}`}>
              {m.text}
              {m.src && <div className="src">{m.src}</div>}
            </div>
          ))}
        </div>
        <div className="sugs">
          {SUGERENCIAS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
        <form
          className="chat-in"
          onSubmit={(e) => {
            e.preventDefault();
            send(q);
          }}
        >
          <input
            ref={input}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Escribe tu pregunta…"
            autoComplete="off"
          />
          <button className="btn primary" aria-label="Enviar">
            <Icon name="send" size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
