import type {
  SeiaDocument,
  SeiaPertinencia,
  SeiaProject,
} from "@hackaton/contracts";
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import { SeiaClient, type SeiaPage } from "./seia.client.js";

@Controller("seia")
export class SeiaController {
  constructor(private readonly seia: SeiaClient) {}

  @Get("projects")
  projects(
    @Query("name") name = "",
    @Query("titular") titular = "",
  ): Promise<SeiaPage<SeiaProject>> {
    requireSearchTerm(name, titular);
    return this.seia.searchProjects(name.trim(), titular.trim());
  }

  @Get("projects/:expedienteId/documents")
  documents(
    @Param("expedienteId") expedienteId: string,
  ): Promise<SeiaDocument[]> {
    if (!/^\d{1,20}$/.test(expedienteId)) {
      throw new BadRequestException(
        "El identificador del expediente no es válido.",
      );
    }
    return this.seia.listDocuments(expedienteId);
  }

  @Get("pertinencias")
  pertinencias(
    @Query("name") name = "",
    @Query("proponent") proponent = "",
  ): Promise<SeiaPage<SeiaPertinencia>> {
    requireSearchTerm(name, proponent);
    return this.seia.searchPertinencias(name.trim(), proponent.trim());
  }
}

function requireSearchTerm(...terms: string[]): void {
  if (terms.every((term) => typeof term !== "string" || term.trim() === "")) {
    throw new BadRequestException("Indica al menos un criterio de búsqueda.");
  }
}
