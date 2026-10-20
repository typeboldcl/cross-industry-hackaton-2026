export interface QuoteLocation {
  start: number;
  end: number;
}

interface Normalized {
  text: string;
  origin: number[];
}

const QUOTES: Record<string, string> = {
  "“": '"',
  "”": '"',
  "«": '"',
  "»": '"',
  "‘": "'",
  "’": "'",
};

function normalize(text: string): Normalized {
  const chars: string[] = [];
  const origin: number[] = [];
  let pendingSpace = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] ?? "";

    if (char === "-" && /^-[ \t]*[\n\f]/.test(text.slice(i, i + 4))) {
      while (i + 1 < text.length && /\s/.test(text[i + 1] ?? "")) i += 1;
      continue;
    }

    if (/\s/.test(char)) {
      pendingSpace = chars.length > 0;
      continue;
    }

    if (pendingSpace) {
      chars.push(" ");
      origin.push(i);
      pendingSpace = false;
    }

    chars.push((QUOTES[char] ?? char).toLowerCase());
    origin.push(i);
  }

  return { text: chars.join(""), origin };
}

export function locateQuote(
  haystack: string,
  quote: string,
): QuoteLocation | null {
  const needle = normalize(quote).text;
  if (needle.length < 8) return null;

  const normalized = normalize(haystack);
  const index = normalized.text.indexOf(needle);
  if (index === -1) return null;

  const start = normalized.origin[index] ?? 0;
  const last = normalized.origin[index + needle.length - 1] ?? start;
  return { start, end: last + 1 };
}
