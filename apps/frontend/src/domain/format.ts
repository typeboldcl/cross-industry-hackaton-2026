/** AAAA-MM-DD (o ISO) → DD-MM-AAAA */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

export const nowISO = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

/** Días que faltan hasta el final del día indicado (negativo si ya pasó). */
export function daysTo(iso: string, now = new Date()): number {
  return Math.ceil(
    (new Date(`${iso}T23:59:59`).getTime() - now.getTime()) / 86400000,
  );
}

export const plural = (n: number, uno: string, varios = `${uno}s`) =>
  `${n} ${n === 1 ? uno : varios}`;

export const pctLabel = (pct: number | null) => (pct == null ? "—" : `${pct}%`);

export const pctColor = (p: number | null) =>
  p == null
    ? "var(--na)"
    : p >= 85
      ? "var(--ok)"
      : p >= 65
        ? "var(--warn)"
        : "var(--bad)";
