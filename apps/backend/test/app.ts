import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { ENV, type Env } from "../src/common/config/env.js";
import { configureApp } from "../src/configure-app.js";
import { EMBEDDING_CLIENT } from "../src/embeddings/embedding-client.js";
import { FakeEmbeddingClient } from "../src/embeddings/fake-embedding-client.js";
import { FakeLlm } from "../src/llm/fake-llm.js";
import { LLM_CLIENT } from "../src/llm/llm-client.js";
import { MemoryStorage } from "../src/storage/memory-storage.js";
import { STORAGE } from "../src/storage/storage.service.js";

export interface TestApp {
  app: INestApplication<App>;
  storage: MemoryStorage;
  llm: FakeLlm;
  embeddings: FakeEmbeddingClient;
}

export async function createTestApp(
  respond: ConstructorParameters<typeof FakeLlm>[0] = () => ({
    obligations: [],
  }),
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<TestApp> {
  const storage = new MemoryStorage();
  const llm = new FakeLlm(respond);
  const embeddings = new FakeEmbeddingClient();
  const moduleFixture = await customize(
    Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(STORAGE)
      .useValue(storage)
      .overrideProvider(LLM_CLIENT)
      .useValue(llm)
      .overrideProvider(EMBEDDING_CLIENT)
      .useValue(embeddings),
  ).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  configureApp(app, app.get<Env>(ENV));
  await app.init();
  return { app, storage, llm, embeddings };
}
