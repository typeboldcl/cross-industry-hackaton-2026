import { Global, Module } from "@nestjs/common";
import { ENV, type Env } from "../common/config/env.js";
import { ChunkEmbeddingService } from "./chunk-embedding.service.js";
import { EMBEDDING_CLIENT } from "./embedding-client.js";
import { OllamaEmbeddingClient } from "./ollama-embedding-client.js";

@Global()
@Module({
  providers: [
    {
      provide: EMBEDDING_CLIENT,
      inject: [ENV],
      useFactory: (env: Env) => new OllamaEmbeddingClient(env.embeddings),
    },
    ChunkEmbeddingService,
  ],
  exports: [EMBEDDING_CLIENT, ChunkEmbeddingService],
})
export class EmbeddingModule {}
