import { Logger } from "@nestjs/common";
import { Client } from "pg";
import { readEnv } from "../config/env.js";
import { clientConfig } from "./connection.js";
import { dataSource } from "./data-source.js";

async function main(): Promise<void> {
  const env = readEnv();
  const logger = new Logger("Migrate");

  await ensureSchema(
    env.database.schema,
    clientConfig(env.database, env.isLocal),
  );
  await dataSource.initialize();

  try {
    const applied = await dataSource.runMigrations({ transaction: "each" });

    if (applied.length === 0) {
      logger.log(`No pending migrations in "${env.database.schema}".`);
      return;
    }

    for (const migration of applied) {
      logger.log(`Applied: ${migration.name}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

// TypeORM writes its control table into the schema before the first migration runs, so the schema cannot be created by a migration.
export async function ensureSchema(
  schema: string,
  config: ConstructorParameters<typeof Client>[0],
): Promise<void> {
  const client = new Client(config);

  await client.connect();

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main().catch((error: unknown) => {
    new Logger("Migrate").error(
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
}
