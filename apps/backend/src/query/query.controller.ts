import type { QueryResponse } from "@hackaton/contracts";
import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { QueryDto } from "./query.dto.js";
import { QueryService } from "./query.service.js";

@Controller()
export class QueryController {
  constructor(private readonly queries: QueryService) {}

  @Post("facilities/:facilityId/query")
  @HttpCode(200)
  query(
    @Param("facilityId", ParseUUIDPipe) facilityId: string,
    @Body() body: QueryDto,
  ): Promise<QueryResponse> {
    return this.queries.query(facilityId, body);
  }
}
