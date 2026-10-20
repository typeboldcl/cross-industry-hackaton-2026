export type SectionKind =
  "vistos" | "considerando" | "tabla" | "resuelvo" | "paginas";

export function buildSectionKey(kind: SectionKind, id?: string): string {
  const normalizedId = id?.trim().replace(/\.+$/, "").replace(/\s+/g, "");
  return normalizedId ? `${kind} ${normalizedId}` : kind;
}

export function buildPagesKey(pageFrom: number, pageTo: number): string {
  return buildSectionKey("paginas", `${pageFrom}-${pageTo}`);
}

export function sectionKeyId(key: string): string {
  return key.split(" ")[1] ?? "";
}
