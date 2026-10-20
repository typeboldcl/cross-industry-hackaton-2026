import { Module } from "@nestjs/common";
import { QueryController } from "./query.controller.js";
import { QueryService } from "./query.service.js";

@Module({
  controllers: [QueryController],
  providers: [QueryService],
})
export class QueryModule {}
