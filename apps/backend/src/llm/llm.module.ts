import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ENV, type Env } from "../common/config/env.js";
import { ExtractionRunEntity } from "./entities/extraction-run.entity.js";
import { LLM_CLIENT, OrbitLlmClient } from "./llm-client.js";
import { LlmService } from "./llm.service.js";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ExtractionRunEntity])],
  providers: [
    {
      provide: LLM_CLIENT,
      inject: [ENV],
      useFactory: (env: Env) => new OrbitLlmClient(env.llm),
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
