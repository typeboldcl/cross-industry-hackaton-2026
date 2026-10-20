import { z } from "zod";

export const EXTRACT_PROMPT_VERSION = "extract-v1";

export const AUTHORITY_CODES = [
  "SMA",
  "SEA",
  "SERNAPESCA",
  "SUBPESCA",
  "SEREMI_SALUD",
  "DGA",
  "SAG",
  "CMN",
  "DIRECTEMAR",
] as const;

const nullableText = z.string().trim().min(1).nullable().optional();

export const extractedObligationSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  category: z.string().trim().min(1),
  authorityCode: z.enum(AUTHORITY_CODES).nullable().optional(),
  phase: z.enum(["construccion", "operacion", "cierre"]).nullable().optional(),
  frequency: nullableText,
  expectedEvidence: nullableText,
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  attributes: z.record(z.string(), z.unknown()).nullable().optional(),
  quote: z.string().trim().min(1),
});

export const extractionOutputSchema = z.object({
  obligations: z.array(extractedObligationSchema),
});

export type ExtractedObligation = z.infer<typeof extractedObligationSchema>;
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

export const EXTRACT_SYSTEM_PROMPT = `Eres un especialista en cumplimiento ambiental en Chile. Recibes una sección de un documento (RCA, rectificación, pertinencia, resolución sanitaria o norma) que aplica a una instalación de acuicultura.

Extrae SOLO obligaciones auditables del titular: compromisos, condiciones, exigencias, medidas, monitoreos, reportes, plazos o prohibiciones que una auditoría puede verificar con evidencia. No extraigas descripciones del proyecto, antecedentes, considerandos argumentativos ni fórmulas legales sin obligación concreta. Si la sección no contiene obligaciones, devuelve una lista vacía.

Para cada obligación:
- title: frase corta e imperativa (máx. 12 palabras).
- body: la obligación completa en lenguaje claro, con cantidades, lugares y condiciones.
- category: tema breve en minúsculas (p. ej. "monitoreo de efluentes", "residuos peligrosos", "ruido", "fauna", "contingencias", "reportes a la autoridad").
- authorityCode: institución que fiscaliza; uno de ${AUTHORITY_CODES.join(", ")}. Usa SMA si la sección no nombra otra.
- phase: "construccion", "operacion" o "cierre" si la sección lo indica; si no, null.
- frequency: periodicidad si existe (p. ej. "mensual", "diaria", "una vez al inicio de la operación"); si no, null.
- expectedEvidence: qué evidencia demostraría el cumplimiento (p. ej. "informe de monitoreo con resultados de laboratorio acreditado"); si no se puede inferir, null.
- dueDate: fecha límite explícita en formato YYYY-MM-DD; si no hay una fecha concreta, null.
- attributes: objeto con datos adicionales útiles (parámetros, límites, ubicaciones, normas citadas); puede ser {}.
- quote: cita TEXTUAL y exacta copiada de la sección (entre 40 y 300 caracteres) que respalda la obligación. No la parafrasees.

Responde únicamente con un objeto JSON: {"obligations": [ ... ]}.`;

export function extractUserPrompt(input: {
  documentKind: string;
  documentNumber: string | null;
  documentTitle: string;
  sectionKey: string;
  sectionTitle: string;
  part: number;
  partsTotal: number;
  text: string;
}): string {
  const part =
    input.partsTotal > 1 ? ` (parte ${input.part} de ${input.partsTotal})` : "";
  return `Documento: ${input.documentKind}${input.documentNumber ? ` N° ${input.documentNumber}` : ""} — ${input.documentTitle}
Sección: ${input.sectionKey}${input.sectionTitle ? ` — ${input.sectionTitle}` : ""}${part}

${input.text}`;
}
