import { Client } from "pg";
import { useTestEnvironment } from "./test/environment.js";

// Each run starts from an empty schema and migrates from scratch, so every run also proves the migrations apply cleanly.
export default async function setup(): Promise<void> {
  useTestEnvironment();

  const { readEnv } = await import("./src/common/config/env.js");
  const { clientConfig } = await import("./src/common/database/connection.js");
  const env = readEnv();
  const client = new Client(clientConfig(env.database, env.isLocal));

  await client.connect();

  try {
    await client.query(
      `DROP SCHEMA IF EXISTS "${env.database.schema}" CASCADE`,
    );
    await client.query(`CREATE SCHEMA "${env.database.schema}"`);
  } finally {
    await client.end();
  }

  const { dataSource } = await import("./src/common/database/data-source.js");
  await dataSource.initialize();

  try {
    await dataSource.runMigrations({ transaction: "each" });
  } finally {
    await dataSource.destroy();
  }
}
