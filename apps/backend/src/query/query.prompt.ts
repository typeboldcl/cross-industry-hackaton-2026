import { z } from "zod";

export const ANSWER_PROMPT_VERSION = "answer-v1";

export const answerOutputSchema = z.object({
  text: z.string().trim().min(1),
  citations: z.array(
    z.object({
      documentId: z.string().trim().min(1),
      sectionKey: z.string().trim().min(1),
      page: z.number().int().positive().nullable(),
    }),
  ),
});

export type AnswerOutput = z.infer<typeof answerOutputSchema>;

export const ANSWER_SYSTEM_PROMPT = `Eres un especialista en cumplimiento ambiental en Chile. Respondes preguntas sobre los permisos (RCA, rectificaciones, pertinencias, resoluciones sanitarias y normas) de una instalación de acuicultura.

Recibes una pregunta y una lista de pasajes recuperados de esos documentos. Cada pasaje indica documentId, sectionKey, páginas y texto.

Reglas:
- Responde SOLO con lo que dicen los pasajes. No uses conocimiento externo ni supongas datos que no aparecen.
- Cada afirmación debe citar el pasaje que la respalda: menciona en el texto la sección (sectionKey) y la página, p. ej. "(considerando 7.3, pág. 45)".
- Si los pasajes no cubren la pregunta, o solo la cubren en parte, dilo explícitamente: "No encuentro esa información en los documentos de la instalación." No inventes una respuesta.
- Responde en español, de forma breve y precisa, con cantidades, plazos y condiciones tal como aparecen.

Formato de salida:
- text: la respuesta con las citas en línea.
- citations: un elemento por pasaje usado, con el documentId y el sectionKey copiados EXACTAMENTE del pasaje, y page = la página donde aparece lo citado (dentro del rango del pasaje). Si no usaste ningún pasaje, devuelve una lista vacía.

Responde únicamente con un objeto JSON: {"text": "...", "citations": [{"documentId": "...", "sectionKey": "...", "page": 1}]}.`;

export interface AnswerPassage {
  documentId: string;
  documentTitle: string;
  documentNumber: string | null;
  sectionKey: string;
  part: number;
  pageFrom: number | null;
  pageTo: number | null;
  text: string;
}

export function answerUserPrompt(
  question: string,
  passages: AnswerPassage[],
): string {
  const blocks = passages.map((passage, index) => {
    const number = passage.documentNumber
      ? ` N° ${passage.documentNumber}`
      : "";
    const pages =
      passage.pageFrom === passage.pageTo
        ? `${passage.pageFrom ?? "?"}`
        : `${passage.pageFrom ?? "?"}-${passage.pageTo ?? "?"}`;
    return `[Pasaje ${index + 1}]
documentId: ${passage.documentId}
Documento: ${passage.documentTitle}${number}
sectionKey: ${passage.sectionKey}${passage.part > 1 ? ` (parte ${passage.part})` : ""}
Páginas: ${pages}

${passage.text}`;
  });

  return `Pregunta: ${question}

${blocks.join("\n\n---\n\n")}`;
}
