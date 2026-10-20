import type { DocumentKind } from "@hackaton/contracts";
import type { Section } from "./sectioner.js";
import { sectionKeyId } from "./section-key.js";

const KEPT_TABLE_CHAPTERS = new Set([6, 7, 8, 9]);
const FIRST_KEPT_CONSIDERANDO = 10;
const KEPT_NESTED_ROOT = "4.3";

function isKeptRcaSection(section: Section): boolean {
  const id = sectionKeyId(section.key);
  const chapter = Number(id.split(".")[0]);

  switch (section.kind) {
    case "tabla":
      return KEPT_TABLE_CHAPTERS.has(chapter);
    case "resuelvo":
      return true;
    case "considerando":
      return (
        chapter >= FIRST_KEPT_CONSIDERANDO ||
        id === KEPT_NESTED_ROOT ||
        id.startsWith(`${KEPT_NESTED_ROOT}.`)
      );
    default:
      return false;
  }
}

export function filterSections(
  kind: DocumentKind,
  sections: Section[],
): Section[] {
  return kind === "rca" ? sections.filter(isKeptRcaSection) : sections;
}

const TABLE_CHAPTER_PRIORITY: Record<number, number> = {
  8: 0,
  9: 2,
  7: 3,
  6: 4,
};

function priorityOf(section: Section): number {
  const id = sectionKeyId(section.key);
  const chapter = Number(id.split(".")[0]);

  if (section.kind === "tabla") return TABLE_CHAPTER_PRIORITY[chapter] ?? 5;
  if (section.kind === "considerando" && chapter >= FIRST_KEPT_CONSIDERANDO) {
    return 1;
  }
  return section.kind === "resuelvo" ? 7 : 6;
}

// Orbit's shared rate limit can cut a run short, so the commitments that matter most to an audit are extracted first.
export function prioritizeSections(sections: Section[]): Section[] {
  return sections
    .map((section, index) => ({ section, index }))
    .sort(
      (a, b) =>
        priorityOf(a.section) - priorityOf(b.section) || a.index - b.index,
    )
    .map(({ section }) => section);
}
