import { extractText, getDocumentProxy } from "unpdf";

const REPEATED_LINE_SHARE = 0.5;
const MIN_PAGES_FOR_STRIPPING = 4;

export async function extractPages(pdf: Buffer): Promise<string[]> {
  const document = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(document, { mergePages: false });
  return stripRepeatedLines(text);
}

// Signature stamps and running headers repeat on most pages and would otherwise be quoted as if they were obligations.
export function stripRepeatedLines(pages: string[]): string[] {
  if (pages.length < MIN_PAGES_FOR_STRIPPING) return pages;

  const pagesPerLine = new Map<string, number>();
  for (const page of pages) {
    for (const line of new Set(page.split("\n").map((l) => l.trim()))) {
      if (line) pagesPerLine.set(line, (pagesPerLine.get(line) ?? 0) + 1);
    }
  }

  const repeated = new Set(
    [...pagesPerLine]
      .filter(([, count]) => count / pages.length > REPEATED_LINE_SHARE)
      .map(([line]) => line),
  );

  if (repeated.size === 0) return pages;

  return pages.map((page) =>
    page
      .split("\n")
      .filter((line) => !repeated.has(line.trim()))
      .join("\n"),
  );
}
