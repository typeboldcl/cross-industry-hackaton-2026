import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { filterSections } from "./section-filter.js";
import { sectionDocument } from "./sectioner.js";

const filler = (label: string) => `${label} ${"texto ".repeat(40)}`.trim();

const syntheticPages = [
  [
    "  RESOLUCIÓN EXENTA N° 1",
    "VISTOS:",
    filler("Lo dispuesto en la ley."),
    "CONSIDERANDO:",
    "1°. Que, INVERMAR S.A. presentó el proyecto.",
    filler("Detalle primero."),
  ].join("\n"),
  [
    "4. Que, el proyecto consiste en lo siguiente.",
    "4.3. PARTES, OBRAS Y ACCIONES",
    "1. Fecha y hora de medición.",
    "2. Ubicación del punto.",
    "4.3.1. FASE DE CONSTRUCCIÓN",
    filler("Obras."),
    "Tabla 6.1.1. Permiso para introducir especies",
    "fila a",
  ].join("\n"),
  [
    "Tabla 8.15. Compromiso ambiental voluntario: Plan de Monitoreo",
    "fila b",
    "10. Que, durante la evaluación se constató.",
    "10.1. Normas relacionadas",
    "RESUELVO:",
    "1. Calificar favorablemente el proyecto.",
    "2. Hacer presente lo siguiente.",
    "3. Archivar.",
  ].join("\n"),
];

describe("sectionDocument", () => {
  const sections = sectionDocument(syntheticPages);
  const keys = sections.map((s) => s.key);

  it("detects headings in document order", () => {
    expect(keys).toEqual([
      "vistos",
      "considerando 1",
      "considerando 4",
      "considerando 4.3",
      "considerando 4.3.1",
      "tabla 6.1.1",
      "tabla 8.15",
      "considerando 10",
      "considerando 10.1",
      "resuelvo",
      "resuelvo 1",
      "resuelvo 2",
      "resuelvo 3",
    ]);
  });

  it("does not split on numbered list items inside a considerando", () => {
    const nested = sections.find((s) => s.key === "considerando 4.3");
    expect(nested?.text).toContain("1. Fecha y hora de medición.");
    expect(nested?.text).toContain("2. Ubicación del punto.");
  });

  it("sets kinds and titles", () => {
    const tabla = sections.find((s) => s.key === "tabla 8.15");
    expect(tabla?.kind).toBe("tabla");
    expect(tabla?.title).toBe(
      "Compromiso ambiental voluntario: Plan de Monitoreo",
    );
    expect(sections.find((s) => s.key === "considerando 4.3.1")?.title).toBe(
      "FASE DE CONSTRUCCIÓN",
    );
  });

  it("drops a short preamble", () => {
    expect(sections[0]?.charStart).toBe(
      syntheticPages.join("\f").indexOf("VISTOS:"),
    );
    expect(sections[0]?.key).toBe("vistos");
  });

  it("keeps a long preamble as a pages section", () => {
    const result = sectionDocument([
      `${"preambulo ".repeat(30)}\nVISTOS:\nalgo`,
    ]);
    expect(result.map((s) => s.key)).toEqual(["paginas 1-1", "vistos"]);
  });

  it("keeps offsets and pages consistent with the joined text", () => {
    const full = syntheticPages.join("\f");
    for (const section of sections) {
      expect(full.slice(section.charStart, section.charEnd)).toBe(section.text);
      const before = full.slice(0, section.charStart).split("\f").length;
      expect(section.pageFrom).toBe(before);
    }
    const tabla = sections.find((s) => s.key === "tabla 8.15");
    expect(tabla?.pageFrom).toBe(3);
    const crossing = sections.find((s) => s.key === "considerando 4.3.1");
    expect(crossing?.pageFrom).toBe(2);
    expect(crossing?.pageTo).toBe(2);
    expect(sections.find((s) => s.key === "considerando 1")?.pageTo).toBe(1);
  });

  it("splits sections longer than 6000 characters at line breaks", () => {
    const body = Array.from({ length: 400 }, (_, i) => `linea ${i} xxxxxxxx`);
    const result = sectionDocument([
      `VISTOS:\n${body.join("\n")}\nCONSIDERANDO:\n1°. Que, algo.`,
    ]);
    const vistos = result.filter((s) => s.key === "vistos");
    expect(vistos.length).toBeGreaterThan(1);
    for (const [index, part] of vistos.entries()) {
      expect(part.text.length).toBeLessThanOrEqual(6000);
      expect(part.part).toBe(index + 1);
      expect(part.partsTotal).toBe(vistos.length);
      expect(part.title).toBe("VISTOS");
      if (index < vistos.length - 1)
        expect(part.text.endsWith("\n")).toBe(true);
    }
    expect(vistos[1]?.charStart).toBe(vistos[0]?.charEnd);
    expect(result.at(-1)?.key).toBe("considerando 1");
  });

  it("falls back to 3-page windows when there are no headings", () => {
    const pages = Array.from(
      { length: 7 },
      (_, i) => `texto de pagina ${i + 1}`,
    );
    const result = sectionDocument(pages);
    expect(result.map((s) => s.key)).toEqual([
      "paginas 1-3",
      "paginas 4-6",
      "paginas 7-7",
    ]);
    expect(result.every((s) => s.kind === "paginas")).toBe(true);
    expect(result[1]?.pageFrom).toBe(4);
    expect(result[1]?.pageTo).toBe(6);
  });

  it("returns nothing for an empty document", () => {
    expect(sectionDocument([])).toEqual([]);
  });
});

const rcaPath = resolve(
  import.meta.dirname,
  "../../../../reference/rca-aucha.pages.json",
);

describe("real RCA", () => {
  it.skipIf(!existsSync(rcaPath))(
    "is sectioned and filtered as expected",
    () => {
      const { pages } = JSON.parse(readFileSync(rcaPath, "utf8")) as {
        pages: string[];
      };
      const sections = sectionDocument(pages);
      const keys = new Set(sections.map((s) => s.key));

      const tablas = [...keys].filter((k) => k.startsWith("tabla "));
      const keptChapterTablas = tablas.filter((k) => /^tabla [6-9]\./.test(k));
      expect(tablas).toHaveLength(80);
      expect(keptChapterTablas).toHaveLength(79);
      expect(sections.find((s) => s.key === "tabla 9.1")?.title).toMatch(
        /^Riesgo o contingencia/,
      );
      for (let n = 1; n <= 18; n++) expect(keys).toContain(`considerando ${n}`);
      for (let n = 1; n <= 7; n++) expect(keys).toContain(`resuelvo ${n}`);

      const kept = new Set(filterSections("rca", sections).map((s) => s.key));
      for (const tabla of keptChapterTablas) expect(kept).toContain(tabla);
      expect(kept).not.toContain("tabla 4.4");
      for (let n = 10; n <= 18; n++)
        expect(kept).toContain(`considerando ${n}`);
      expect(kept).toContain("resuelvo");
      for (let n = 1; n <= 7; n++) expect(kept).toContain(`resuelvo ${n}`);
      expect(kept).not.toContain("vistos");
      for (let n = 1; n <= 3; n++)
        expect(kept).not.toContain(`considerando ${n}`);
      expect([...kept].filter((k) => k.startsWith("considerando 5"))).toEqual(
        [],
      );
    },
  );
});
