const FILENAME_NUMBER = /RCA_N_(\d{12})/i;
const TEXT_NUMBER = /Resoluci[oó]n\s+Exenta\s+N[°º]?\s*:?\s*(\d[\d/-]*)/i;
const SHORT_FORM = /^(\d{1,4})[/-](\d{4})$/;

export function numberFromFilename(filename: string): string | null {
  return FILENAME_NUMBER.exec(filename)?.[1] ?? null;
}

export function numberFromText(pages: string[]): string | null {
  const head = pages.slice(0, 2).join("\n");
  const match = TEXT_NUMBER.exec(head);
  return match ? normalizeDocumentNumber(match[1] ?? "") : null;
}

export function normalizeDocumentNumber(raw: string): string | null {
  const value = raw.trim().replace(/[.\s]/g, "");
  if (/^\d{9,12}$/.test(value)) return value;

  const short = SHORT_FORM.exec(value);
  return short ? `${Number(short[1])}/${short[2]}` : null;
}
