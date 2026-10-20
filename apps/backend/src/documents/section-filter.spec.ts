import type { Section } from "./sectioner.js";
import { filterSections } from "./section-filter.js";

function section(key: string): Section {
  const [kind] = key.split(" ");
  return {
    key,
    kind: kind as Section["kind"],
    title: key,
    text: key,
    pageFrom: 1,
    pageTo: 1,
    charStart: 0,
    charEnd: key.length,
    part: 1,
    partsTotal: 1,
  };
}

const allKeys = [
  "vistos",
  "considerando 1",
  "considerando 3",
  "considerando 4",
  "considerando 4.1",
  "considerando 4.2",
  "considerando 4.3",
  "considerando 4.3.1",
  "considerando 4.3.2",
  "considerando 5",
  "considerando 5.1",
  "considerando 6",
  "considerando 6.1",
  "considerando 9",
  "considerando 10",
  "considerando 10.1",
  "considerando 18",
  "tabla 4.3.1",
  "tabla 5.1",
  "tabla 6.1.1",
  "tabla 7.2",
  "tabla 8.15",
  "tabla 9.3",
  "tabla 10.1",
  "resuelvo",
  "resuelvo 1",
  "resuelvo 7",
  "paginas 1-3",
];

describe("filterSections", () => {
  const sections = allKeys.map(section);

  it("keeps only the relevant RCA sections", () => {
    expect(filterSections("rca", sections).map((s) => s.key)).toEqual([
      "considerando 4.3",
      "considerando 4.3.1",
      "considerando 4.3.2",
      "considerando 10",
      "considerando 10.1",
      "considerando 18",
      "tabla 6.1.1",
      "tabla 7.2",
      "tabla 8.15",
      "tabla 9.3",
      "resuelvo",
      "resuelvo 1",
      "resuelvo 7",
    ]);
  });

  it.each(["rectificacion", "pertinencia", "res_sanitaria", "norma"] as const)(
    "keeps everything for %s",
    (kind) => {
      expect(filterSections(kind, sections)).toEqual(sections);
    },
  );
});
