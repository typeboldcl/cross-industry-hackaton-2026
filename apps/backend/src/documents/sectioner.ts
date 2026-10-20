import {
  buildPagesKey,
  buildSectionKey,
  type SectionKind,
} from "./section-key.js";

export interface Section {
  key: string;
  kind: SectionKind;
  title: string;
  text: string;
  pageFrom: number;
  pageTo: number;
  charStart: number;
  charEnd: number;
  part: number;
  partsTotal: number;
}

interface Heading {
  kind: SectionKind;
  key: string;
  title: string;
  charStart: number;
}

interface Span {
  kind: SectionKind;
  key: string;
  title: string;
  charStart: number;
  charEnd: number;
}

const MAX_SECTION_CHARS = 6000;
const MIN_PREAMBLE_CHARS = 200;
const FALLBACK_PAGE_WINDOW = 3;

const VISTOS = /^VISTOS:/;
const RESUELVO = /^RESUELVO:/;
const CONSIDERANDO = /^(\d{1,2})°?\.\s+Que\b/;
const NESTED = /^(\d{1,2}(?:\.\d+)+)\.?\s+(\p{L}.*)$/u;
const TABLA = /^Tabla\s+(\d+(?:\.\d+)+)\.?:?\s*(.*)$/;
const RESUELVO_ITEM = /^(\d{1,2})\.\s+(\S.*)$/;

function findHeadings(text: string): Heading[] {
  const headings: Heading[] = [];
  let currentConsiderando: string | null = null;
  let inResuelvo = false;
  let lastResuelvoItem = 0;
  let offset = 0;

  for (const rawLine of text.split(/\n|\f/)) {
    const charStart = offset;
    offset += rawLine.length + 1;
    const line = rawLine.trim();
    if (line === "") continue;

    if (VISTOS.test(line)) {
      headings.push({
        kind: "vistos",
        key: buildSectionKey("vistos"),
        title: "VISTOS",
        charStart,
      });
      continue;
    }

    if (RESUELVO.test(line)) {
      inResuelvo = true;
      lastResuelvoItem = 0;
      headings.push({
        kind: "resuelvo",
        key: buildSectionKey("resuelvo"),
        title: "RESUELVO",
        charStart,
      });
      continue;
    }

    if (inResuelvo) {
      const item = RESUELVO_ITEM.exec(line);
      if (item && Number(item[1]) === lastResuelvoItem + 1) {
        lastResuelvoItem += 1;
        headings.push({
          kind: "resuelvo",
          key: buildSectionKey("resuelvo", item[1]),
          title: line,
          charStart,
        });
      }
      continue;
    }

    const tabla = TABLA.exec(line);
    if (tabla) {
      headings.push({
        kind: "tabla",
        key: buildSectionKey("tabla", tabla[1]),
        title: tabla[2] ?? "",
        charStart,
      });
      continue;
    }

    const considerando = CONSIDERANDO.exec(line);
    if (considerando) {
      currentConsiderando = String(Number(considerando[1]));
      headings.push({
        kind: "considerando",
        key: buildSectionKey("considerando", currentConsiderando),
        title: line,
        charStart,
      });
      continue;
    }

    const nested = NESTED.exec(line);
    if (
      nested &&
      currentConsiderando !== null &&
      nested[1]?.split(".")[0] === currentConsiderando
    ) {
      headings.push({
        kind: "considerando",
        key: buildSectionKey("considerando", nested[1]),
        title: nested[2] ?? "",
        charStart,
      });
    }
  }

  return headings;
}

function pageStartOffsets(pages: string[]): number[] {
  const starts: number[] = [];
  let offset = 0;
  for (const page of pages) {
    starts.push(offset);
    offset += page.length + 1;
  }
  return starts;
}

function pageOf(offset: number, text: string): number {
  let page = 1;
  for (let i = text.indexOf("\f"); i !== -1 && i < offset;) {
    page += 1;
    i = text.indexOf("\f", i + 1);
  }
  return page;
}

function splitIntoParts(text: string, charStart: number) {
  const parts: { text: string; charStart: number }[] = [];
  let start = 0;
  while (text.length - start > MAX_SECTION_CHARS) {
    const limit = start + MAX_SECTION_CHARS;
    const lineBreak = text.lastIndexOf("\n", limit - 1);
    const end = lineBreak > start ? lineBreak + 1 : limit;
    parts.push({ text: text.slice(start, end), charStart: charStart + start });
    start = end;
  }
  parts.push({ text: text.slice(start), charStart: charStart + start });
  return parts;
}

function buildSections(fullText: string, spans: Span[]): Section[] {
  const sections: Section[] = [];
  for (const span of spans) {
    const parts = splitIntoParts(
      fullText.slice(span.charStart, span.charEnd),
      span.charStart,
    );
    parts.forEach((part, index) => {
      const charEnd = part.charStart + part.text.length;
      sections.push({
        key: span.key,
        kind: span.kind,
        title: span.title,
        text: part.text,
        pageFrom: pageOf(part.charStart, fullText),
        pageTo: pageOf(Math.max(part.charStart, charEnd - 1), fullText),
        charStart: part.charStart,
        charEnd,
        part: index + 1,
        partsTotal: parts.length,
      });
    });
  }
  return sections;
}

function pageWindowSpans(pages: string[]): Span[] {
  const starts = pageStartOffsets(pages);
  const fullLength = pages.join("\f").length;
  const spans: Span[] = [];
  for (let first = 0; first < pages.length; first += FALLBACK_PAGE_WINDOW) {
    const last = Math.min(first + FALLBACK_PAGE_WINDOW, pages.length) - 1;
    const key = buildPagesKey(first + 1, last + 1);
    spans.push({
      kind: "paginas",
      key,
      title: key,
      charStart: starts[first] ?? 0,
      charEnd:
        last + 1 < pages.length ? (starts[last + 1] ?? fullLength) : fullLength,
    });
  }
  return spans;
}

export function sectionDocument(pages: string[]): Section[] {
  if (pages.length === 0) return [];
  const fullText = pages.join("\f");
  const headings = findHeadings(fullText);
  if (headings.length === 0) {
    return buildSections(fullText, pageWindowSpans(pages));
  }

  const spans: Span[] = headings.map((heading, index) => ({
    kind: heading.kind,
    key: heading.key,
    title: heading.title,
    charStart: heading.charStart,
    charEnd: headings[index + 1]?.charStart ?? fullText.length,
  }));

  const firstStart = headings[0]?.charStart ?? 0;
  if (firstStart >= MIN_PREAMBLE_CHARS) {
    const key = buildPagesKey(1, pageOf(firstStart - 1, fullText));
    spans.unshift({
      kind: "paginas",
      key,
      title: key,
      charStart: 0,
      charEnd: firstStart,
    });
  }

  return buildSections(fullText, spans);
}
