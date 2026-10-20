/**
 * Miniatura de 480 px de una foto, en data URL. La usa el modo demo para
 * mostrar la evidencia sin servidor; el backend real genera la suya.
 */
export function toThumbnail(file: File): Promise<string | null> {
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
