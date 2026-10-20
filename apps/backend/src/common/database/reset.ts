import { Logger } from "@nestjs/common";
import { Client } from "pg";
import { readEnv } from "../config/env.js";
import { clientConfig, isProtectedSchema } from "./connection.js";

async function main(): Promise<void> {
  const env = readEnv();
  const { schema } = env.database;

  if (isProtectedSchema(schema)) {
    throw new Error(`DB_SCHEMA=${schema} is never dropped.`);
  }

  if (!env.isLocal) {
    throw new Error(
      `NODE_ENV=${env.environment}: dropping a whole schema only runs locally.`,
    );
  }

  const confirmed = process.argv
    .find((argument) => argument.startsWith("--schema="))
    ?.slice("--schema=".length);

  if (confirmed !== schema) {
    throw new Error(
      `Repeat the schema you are about to drop: pnpm db:reset --schema=${schema}`,
    );
  }

  const client = new Client(clientConfig(env.database, env.isLocal));

  await client.connect();

  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.query(`CREATE SCHEMA "${schema}"`);
    new Logger("Reset").log(`Schema "${schema}" emptied. Run pnpm db:migrate.`);
  } finally {
    await client.end();
  }
}

await main().catch((error: unknown) => {
  new Logger("Reset").error(
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
