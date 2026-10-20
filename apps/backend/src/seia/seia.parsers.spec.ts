import { BadGatewayException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { SeiaClient } from "./seia.client.js";
import {
  parseExpedienteDocuments,
  parsePertinencias,
  parseProjects,
} from "./seia.parsers.js";

const BASE = "https://seia.sea.gob.cl";

const EXPEDIENTE_HTML = `<table class="tabla_datos_linea"><tbody>
<tr class=impar> <td align="right">1</td> <td align="right"></td> <td>2021-10-175-1</td> <td><a href='https://seia.sea.gob.cl/documentos/documento.php?idDocumento=2154425338' target='_blank'>Declaraci&oacute;n de impacto ambiental (DIA)</a></td> <td>Invermar S.A.</td> <td>Servicio Evaluaci&#243;n Ambiental</td> <td align="center">16/12/2021 19:44:03</td> </tr>
<tr class=par> <td align="right">119</td> <td align="right">202410001185</td> <td>2021-10-175-119</td> <td><a href='https://seia.sea.gob.cl/archivos/2024/09/30/RCA_N_202410001185__Piscicultura_Aucha_.pdf' target='_blank'>Resolución de Calificación Ambiental (RCA)</a></td> <td>Servicio Evaluación Ambiental</td> <td></td> <td align="center">30/09/2024 14:49:39</td> </tr>
<tr class=impar> <td>2</td> <td></td> <td>2021-10-175-2</td> <td><a href='javascript:ventana("/x")'>Sin enlace</a></td> <td>X</td> <td></td> <td align="center">01/01/2022 10:00:00</td> </tr>
</tbody></table>`;

describe("parseProjects", () => {
  it("maps the SEIA search rows", () => {
    const result = parseProjects({
      data: [
        {
          EXPEDIENTE_ID: "2131493322",
          EXPEDIENTE_NOMBRE: "PISCICULTURA DE RECIRCULACION AUCHA",
          WORKFLOW_DESCRIPCION: "DIA",
          REGION_NOMBRE: "Región de Los Lagos",
          COMUNA_NOMBRE: "Calbuco",
          TITULAR: "Invermar S.A.",
          FECHA_PRESENTACION_FORMAT: "16/06/2016",
          ESTADO_PROYECTO: "Aprobado",
        },
      ],
      totalRegistros: 2,
    });

    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      {
        expedienteId: "2131493322",
        name: "PISCICULTURA DE RECIRCULACION AUCHA",
        titular: "Invermar S.A.",
        type: "DIA",
        region: "Región de Los Lagos",
        comuna: "Calbuco",
        submittedOn: "2016-06-16",
        state: "Aprobado",
      },
    ]);
  });

  it("fails loudly with 502 when the shape is unexpected", () => {
    expect(() => parseProjects({ error: true })).toThrow(BadGatewayException);
    expect(() => parseProjects({ data: [{ EXPEDIENTE_ID: "1" }] })).toThrow(
      BadGatewayException,
    );
  }, 20_000);
});

describe("parsePertinencias", () => {
  it("maps rows and keeps nulls", () => {
    const { items } = parsePertinencias({
      data: [
        {
          PERTINENCIA_TIPO: "OLD",
          ID_PERTINENCIA: "2128403492",
          PERTINENCIA_NOMBRE: "Modificaciones al Centro",
          PERTINENCIA_ESTADO: "Resuelta",
          COMUNA_NOMBRE: null,
          PROPONENTE: "INVERMAR SA.",
          FECHA_PRESENTACION_FORMAT: "24/05/2013",
        },
      ],
      totalRegistros: 1,
    });

    expect(items[0]).toMatchObject({
      id: "2128403492",
      kind: "OLD",
      comuna: null,
      submittedOn: "2013-05-24",
    });
  });

  it("rejects an unknown kind", () => {
    expect(() =>
      parsePertinencias({
        data: [
          {
            PERTINENCIA_TIPO: "X",
            ID_PERTINENCIA: "1",
            PERTINENCIA_NOMBRE: "n",
          },
        ],
      }),
    ).toThrow(BadGatewayException);
  });
});

describe("parseExpedienteDocuments", () => {
  it("keeps only rows with a PDF or documento.php link", () => {
    const documents = parseExpedienteDocuments(EXPEDIENTE_HTML, BASE);

    expect(documents).toEqual([
      {
        folio: "2021-10-175-1",
        type: "Declaración de impacto ambiental (DIA)",
        sender: "Invermar S.A.",
        date: "2021-12-16",
        title: "Declaración de impacto ambiental (DIA)",
        url: "https://seia.sea.gob.cl/documentos/documento.php?idDocumento=2154425338",
      },
      {
        folio: "2021-10-175-119",
        type: "Resolución de Calificación Ambiental (RCA)",
        sender: "Servicio Evaluación Ambiental",
        date: "2024-09-30",
        title: "RCA_N_202410001185__Piscicultura_Aucha_",
        url: "https://seia.sea.gob.cl/archivos/2024/09/30/RCA_N_202410001185__Piscicultura_Aucha_.pdf",
      },
    ]);
  });

  it("fails loudly when the table is missing", () => {
    expect(() => parseExpedienteDocuments("<html></html>", BASE)).toThrow(
      BadGatewayException,
    );
  }, 20_000);
});

describe("SeiaClient.assertAllowedUrl", () => {
  const client = new SeiaClient({ seiaBaseUrl: BASE } as never);

  it("accepts SEIA hosts over https", () => {
    expect(() =>
      client.assertAllowedUrl("https://infofirma.sea.gob.cl/a.pdf"),
    ).not.toThrow();
  });

  it.each([
    "http://seia.sea.gob.cl/a.pdf",
    "https://evil.example.com/a.pdf",
    "https://seia.sea.gob.cl.evil.com/a.pdf",
    "not a url",
  ])("rejects %s", (url) => {
    expect(() => client.assertAllowedUrl(url)).toThrow();
  });
});

describe.skipIf(!process.env.LIVE_SEIA)("SEIA live", () => {
  it("finds Piscicultura Aucha", async () => {
    const client = new SeiaClient({ seiaBaseUrl: BASE } as never);
    const { items } = await client.searchProjects("Piscicultura Aucha", "");
    const ids = items.map((item) => item.expedienteId);
    expect(ids).toContain("2131493322");
    expect(ids).toContain("2154425334");
  });

  it("lists the RCA among the expediente documents", async () => {
    const client = new SeiaClient({ seiaBaseUrl: BASE } as never);
    const documents = await client.listDocuments("2154425334");
    expect(documents.map((document) => document.url)).toContain(
      "https://seia.sea.gob.cl/archivos/2024/09/30/RCA_N_202410001185__Piscicultura_Aucha_.pdf",
    );
  }, 20_000);
});
