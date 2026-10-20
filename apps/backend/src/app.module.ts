import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditsModule } from "./audits/audits.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { ComplianceModule } from "./compliance/compliance.module.js";
import { ContextModule } from "./context/context.module.js";
import { ENV, type Env } from "./common/config/env.js";
import { EnvModule } from "./common/config/env.module.js";
import { postgresOptions } from "./common/database/connection.js";
import { ENTITIES } from "./common/database/entities.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { HealthModule } from "./health/health.module.js";
import { LlmModule } from "./llm/llm.module.js";
import { ObligationsModule } from "./obligations/obligations.module.js";
import { SeiaModule } from "./seia/seia.module.js";
import { StorageModule } from "./storage/storage.module.js";

@Module({
  imports: [
    EnvModule,
    TypeOrmModule.forRootAsync({
      imports: [EnvModule],
      inject: [ENV],
      useFactory: (env: Env) => ({
        ...postgresOptions(env.database, env.isLocal),
        entities: ENTITIES,
      }),
    }),
    StorageModule,
    LlmModule,
    HealthModule,
    CatalogModule,
    DocumentsModule,
    ObligationsModule,
    AuditsModule,
    ComplianceModule,
    ContextModule,
    SeiaModule,
  ],
})
export class AppModule {}
