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
