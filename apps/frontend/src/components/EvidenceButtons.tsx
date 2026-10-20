import { useRef } from "react";
import { api, run } from "../api";
import { Icon } from "./Icon";

/** "Tomar foto" (abre la cámara en el celular) y "Adjuntar" para un requisito. */
export function EvidenceButtons({
  aid,
  rid,
  small,
}: {
  aid: string;
  rid: string;
  small?: boolean;
}) {
  const photo = useRef<HTMLInputElement>(null);
  const any = useRef<HTMLInputElement>(null);
  const onFile = async (input: HTMLInputElement) => {
    const f = input.files?.[0];
    input.value = "";
    if (f) await run(api.evidence.upload(aid, rid, f));
  };
  const size = small ? 16 : 18;
  const cls = small ? "btn sm" : "btn grow";

  return (
    <>
      <input
        ref={photo}
        type="file"
        accept="image/*"
        capture="environment"
        className="hide"
        onChange={(e) => void onFile(e.target)}
      />
      <input
        ref={any}
        type="file"
        accept="image/*,application/pdf,.pdf,.xlsx,.docx"
        className="hide"
        onChange={(e) => void onFile(e.target)}
      />
      <button className={cls} onClick={() => photo.current?.click()}>
        <Icon name="cam" size={size} /> {small ? "Foto" : "Tomar foto"}
      </button>
      <button className={cls} onClick={() => any.current?.click()}>
        <Icon name="clip" size={size} /> Adjuntar
      </button>
    </>
  );
}
