import type {
  SeiaDocument,
  SeiaPertinencia,
  SeiaProject,
} from "@hackaton/contracts";
import { BadGatewayException } from "@nestjs/common";

const SHAPE_ERROR = "El SEIA respondió con un formato inesperado.";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ...Object.fromEntries([
    ["aacute", "á"],
    ["eacute", "é"],
    ["iacute", "í"],
    ["oacute", "ó"],
    ["uacute", "ú"],
    ["Aacute", "Á"],
    ["Eacute", "É"],
    ["Iacute", "Í"],
    ["Oacute", "Ó"],
    ["Uacute", "Ú"],
    ["ntilde", "ñ"],
    ["Ntilde", "Ñ"],
    ["uuml", "ü"],
  ]),
};

export function parseProjects(payload: unknown): {
  items: SeiaProject[];
  total: number;
} {
  const { rows, total } = readRows(payload);
  return {
    total,
    items: rows.map((row) => ({
      expedienteId: requiredText(row, "EXPEDIENTE_ID"),
      name: requiredText(row, "EXPEDIENTE_NOMBRE"),
      titular: optionalText(row, "TITULAR") ?? "",
      type: optionalText(row, "WORKFLOW_DESCRIPCION") ?? "",
      region: optionalText(row, "REGION_NOMBRE"),
      comuna: optionalText(row, "COMUNA_NOMBRE"),
      submittedOn: isoDate(optionalText(row, "FECHA_PRESENTACION_FORMAT")),
      state: optionalText(row, "ESTADO_PROYECTO"),
    })),
  };
}

export function parsePertinencias(payload: unknown): {
  items: SeiaPertinencia[];
  total: number;
} {
  const { rows, total } = readRows(payload);
  return {
    total,
    items: rows.map((row) => {
      const kind = requiredText(row, "PERTINENCIA_TIPO");
      if (kind !== "OLD" && kind !== "NEW") {
        throw new BadGatewayException(SHAPE_ERROR);
      }
      return {
        id: requiredText(row, "ID_PERTINENCIA"),
        kind,
        name: requiredText(row, "PERTINENCIA_NOMBRE"),
        proponent: optionalText(row, "PROPONENTE") ?? "",
        comuna: optionalText(row, "COMUNA_NOMBRE"),
        state: optionalText(row, "PERTINENCIA_ESTADO"),
        submittedOn: isoDate(optionalText(row, "FECHA_PRESENTACION_FORMAT")),
      };
    }),
  };
}

export function parseExpedienteDocuments(
  html: string,
  baseUrl: string,
): SeiaDocument[] {
  if (!html.includes("tabla_datos_linea")) {
    throw new BadGatewayException(SHAPE_ERROR);
  }

  const documents: SeiaDocument[] = [];
  for (const rowHtml of html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = (rowHtml.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) ?? []).map(
      (cell) => cell.replace(/^<td\b[^>]*>/i, "").replace(/<\/td>$/i, ""),
    );
    if (cells.length < 7) continue;

    const link = findPdfLink(cells[3]!, baseUrl);
    if (!link) continue;

    documents.push({
      folio: textOrNull(cells[2]!),
      type: link.text,
      sender: textOrNull(cells[4]!),
      date: isoDate(textOrNull(cells[6]!)?.slice(0, 10) ?? null),
      title: link.filename ?? link.text,
      url: link.url,
    });
  }
  return documents;
}

function findPdfLink(
  cell: string,
  baseUrl: string,
): { url: string; text: string; filename: string | null } | null {
  for (const match of cell.matchAll(
    /<a\b[^>]*?href\s*=\s*(?:'([^']*)'|"([^"]*)")[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const href = decodeEntities(match[1] ?? match[2] ?? "");
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    const isDirectPdf =
      url.pathname.startsWith("/archivos/") &&
      url.pathname.toLowerCase().endsWith(".pdf");
    const isDocumentPage =
      url.pathname === "/documentos/documento.php" &&
      url.searchParams.has("idDocumento");
    if (!isDirectPdf && !isDocumentPage) continue;

    const text = htmlToText(match[3]!);
    if (!text) continue;
    return {
      url: url.toString(),
      text,
      filename: isDirectPdf ? filenameOf(url) : null,
    };
  }
  return null;
}

function filenameOf(url: URL): string | null {
  const last = url.pathname.split("/").pop() ?? "";
  try {
    return decodeURIComponent(last).replace(/\.pdf$/i, "") || null;
  } catch {
    return last.replace(/\.pdf$/i, "") || null;
  }
}

function readRows(payload: unknown): {
  rows: Record<string, unknown>[];
  total: number;
} {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new BadGatewayException(SHAPE_ERROR);
  }
  const rows = payload.data;
  if (!rows.every(isRecord)) throw new BadGatewayException(SHAPE_ERROR);
  const total = Number(payload.totalRegistros ?? rows.length);
  return { rows, total: Number.isFinite(total) ? total : rows.length };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = row[key];
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function requiredText(row: Record<string, unknown>, key: string): string {
  const text = optionalText(row, key);
  if (text === null) throw new BadGatewayException(SHAPE_ERROR);
  return text;
}

function isoDate(formatted: string | null): string | null {
  const match = formatted?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function textOrNull(html: string): string | null {
  return htmlToText(html) || null;
}

function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (whole, entity: string) => {
      if (entity.startsWith("#x")) {
        return String.fromCodePoint(parseInt(entity.slice(2), 16));
      }
      if (entity.startsWith("#")) {
        return String.fromCodePoint(parseInt(entity.slice(1), 10));
      }
      return (
        NAMED_ENTITIES[entity] ?? NAMED_ENTITIES[entity.toLowerCase()] ?? whole
      );
    },
  );
}
