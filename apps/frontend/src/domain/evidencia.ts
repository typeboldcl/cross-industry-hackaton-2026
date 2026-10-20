import type { Evidencia } from "@hackaton/contracts";
import { today } from "./format";

/** Reduce la foto a 480 px para guardarla en el teléfono sin llenar el almacenamiento. */
function resizeImage(file: File): Promise<string | null> {
  return new Promise((res) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 480 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * k;
      c.height = img.height * k;
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => res(null);
    img.src = url;
  });
}

export async function toEvidencia(file: File): Promise<Evidencia> {
  return {
    nombre: file.name || "foto.jpg",
    fecha: today(),
    thumb: file.type.startsWith("image/") ? await resizeImage(file) : null,
    sync: false,
  };
}
