import type {
  SeiaDocument,
  SeiaPertinencia,
  SeiaProject,
} from "@hackaton/contracts";
import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { ENV, type Env } from "../common/config/env.js";
import {
  parseExpedienteDocuments,
  parsePertinenciaProcessId,
  parsePertinenciaResolution,
  parsePertinencias,
  parseProjects,
} from "./seia.parsers.js";

const REQUEST_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const PERTINENCIA_BASE_URL = "https://pertinencia.sea.gob.cl";
const ALLOWED_HOSTS = new Set([
  "seia.sea.gob.cl",
  "infofirma.sea.gob.cl",
  "pertinencia.sea.gob.cl",
]);
const UNAVAILABLE = "No se pudo consultar el SEIA. Inténtalo nuevamente.";

export interface SeiaPage<T> {
  items: T[];
  total: number;
}

export interface PertinenciaPdf {
  pdfUrl: string;
  title: string;
}

export interface DownloadedPdf {
  buffer: Buffer;
  filename: string;
  finalUrl: string;
}

@Injectable()
export class SeiaClient {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async searchProjects(
    name: string,
    titular: string,
    page = 1,
    limit = 20,
  ): Promise<SeiaPage<SeiaProject>> {
    const body = await this.request(
      "/busqueda/buscarProyectoResumenAction.php",
      { nombre: name, titular, offset: String(page), limit: String(limit) },
    );
    return parseProjects(parseJson(body));
  }

  async listDocuments(expedienteId: string): Promise<SeiaDocument[]> {
    const query = new URLSearchParams({ id_expediente: expedienteId });
    const html = await this.request(`/expediente/xhr_expediente2.php?${query}`);
    return parseExpedienteDocuments(html, this.env.seiaBaseUrl);
  }

  async searchPertinencias(
    name: string,
    proponent: string,
    start = 0,
    length = 20,
  ): Promise<SeiaPage<SeiaPertinencia>> {
    const body = await this.request(
      "/pertinencia/resumenPertinenciaBuscar.php",
      {
        p_nombre_pertinencia: name,
        p_proponent: proponent,
        start: String(start),
        length: String(length),
      },
    );
    return parsePertinencias(parseJson(body));
  }

  async resolvePertinenciaPdf(pertinenciaId: string): Promise<PertinenciaPdf> {
    const processId = parsePertinenciaProcessId(
      parseJson(
        await this.fetchText(
          new URL("/api/public/buscarCp", PERTINENCIA_BASE_URL),
          { pertinenciaFilter: { id: pertinenciaId } },
        ),
      ),
    );
    if (!processId) {
      throw new BadRequestException(
        `La pertinencia ${pertinenciaId} no existe en el SEA.`,
      );
    }

    const resolution = parsePertinenciaResolution(
      parseJson(
        await this.fetchText(
          new URL(
            `/api/public/expediente/getPertinenciaFull/${encodeURIComponent(processId)}`,
            PERTINENCIA_BASE_URL,
          ),
        ),
      ),
    );
    if (!resolution) {
      throw new BadRequestException(
        `La pertinencia ${pertinenciaId} todavía no tiene una resolución publicada.`,
      );
    }

    return {
      pdfUrl: new URL(
        `/api/public/documentos/getDocumentoPDF/${encodeURIComponent(resolution.archiveId)}`,
        PERTINENCIA_BASE_URL,
      ).toString(),
      title: `${resolution.name} · ${resolution.title}`,
    };
  }

  async downloadPdf(url: string): Promise<DownloadedPdf> {
    let current = this.assertAllowedUrl(url);
    const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);

    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const response = await fetch(current, { redirect: "manual", signal });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) throw new BadGatewayException(UNAVAILABLE);
          await response.body?.cancel();
          current = this.assertAllowedUrl(
            new URL(location, current).toString(),
          );
          continue;
        }

        if (!response.ok) {
          await response.body?.cancel();
          throw new BadGatewayException(
            `El SEIA respondió con el estado ${response.status} al descargar el documento.`,
          );
        }

        return {
          buffer: await readCapped(response),
          filename: filenameFromUrl(current),
          finalUrl: current.toString(),
        };
      }
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof BadRequestException) throw error;
      throw new BadGatewayException(UNAVAILABLE);
    }
    throw new BadGatewayException("El SEIA redirigió demasiadas veces.");
  }

  assertAllowedUrl(raw: string): URL {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException("La URL del documento no es válida.");
    }
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
      throw new BadRequestException(
        "Solo se pueden importar documentos desde seia.sea.gob.cl, infofirma.sea.gob.cl o pertinencia.sea.gob.cl.",
      );
    }
    return url;
  }

  private async request(
    path: string,
    form?: Record<string, string>,
  ): Promise<string> {
    const response = await this.send(new URL(path, this.env.seiaBaseUrl), {
      method: form ? "POST" : "GET",
      headers: form
        ? { "content-type": "application/x-www-form-urlencoded" }
        : undefined,
      body: form ? new URLSearchParams(form) : undefined,
    });
    return new TextDecoder("latin1").decode(response);
  }

  private async fetchText(url: URL, json?: unknown): Promise<string> {
    const response = await this.send(url, {
      method: json === undefined ? "GET" : "POST",
      headers:
        json === undefined ? undefined : { "content-type": "application/json" },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
    return new TextDecoder().decode(response);
  }

  private async send(url: URL, init: RequestInit): Promise<ArrayBuffer> {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new BadGatewayException(UNAVAILABLE);
      return await response.arrayBuffer();
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(UNAVAILABLE);
    }
  }
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new BadGatewayException(
      "El SEIA respondió con un formato inesperado.",
    );
  }
}

async function readCapped(response: Response): Promise<Buffer> {
  const tooLarge = new BadRequestException(
    "El documento supera el tamaño máximo de 50 MB.",
  );
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_DOWNLOAD_BYTES) throw tooLarge;
  if (!response.body) return Buffer.alloc(0);

  const chunks: Uint8Array[] = [];
  let received = 0;
  for await (const chunk of response.body) {
    received += chunk.byteLength;
    if (received > MAX_DOWNLOAD_BYTES) throw tooLarge;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function filenameFromUrl(url: URL): string {
  const last = url.pathname.split("/").pop() ?? "";
  try {
    return decodeURIComponent(last) || "documento-seia.pdf";
  } catch {
    return last || "documento-seia.pdf";
  }
}
