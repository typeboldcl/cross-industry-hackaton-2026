import { Module } from "@nestjs/common";
import { SeiaClient } from "./seia.client.js";
import { SeiaController } from "./seia.controller.js";

@Module({
  controllers: [SeiaController],
  providers: [SeiaClient],
  exports: [SeiaClient],
})
export class SeiaModule {}
