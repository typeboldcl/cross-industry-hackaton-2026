import { readFileSync } from "node:fs";
import type { ConnectionOptions } from "node:tls";
import type { ClientConfig } from "pg";
import type { DatabaseConnection } from "../config/env.js";

const PROTECTED_SCHEMAS = new Set(["production", "demo"]);

type SslOptions = Pick<
  ConnectionOptions,
  "ca" | "rejectUnauthorized" | "checkServerIdentity"
>;

export function isProtectedSchema(schema: string): boolean {
  return PROTECTED_SCHEMAS.has(schema.trim().toLowerCase());
}

export function sslOptions(
  connection: DatabaseConnection,
  isLocal: boolean,
): SslOptions {
  if (!connection.sslCa) {
    return { rejectUnauthorized: false };
  }

  const ca = readFileSync(connection.sslCa, "utf8");

  // The RDS certificate names its private IP (192.168.0.185), so a laptop reaching it through the EIP can only verify the CA, not the hostname.
  return isLocal
    ? { ca, rejectUnauthorized: true, checkServerIdentity: () => undefined }
    : { ca, rejectUnauthorized: true };
}

export function clientConfig(
  connection: DatabaseConnection,
  isLocal: boolean,
): ClientConfig {
  return {
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password: connection.password,
    database: connection.database,
    ssl: sslOptions(connection, isLocal),
    connectionTimeoutMillis: 10_000,
  };
}

export function postgresOptions(
  connection: DatabaseConnection,
  isLocal: boolean,
) {
  return {
    type: "postgres" as const,
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password: connection.password,
    database: connection.database,
    schema: connection.schema,
    ssl: sslOptions(connection, isLocal),
    synchronize: false,
    installExtensions: false,
    extra: {
      // `public` holds pgvector's type and operator classes, installed once per database by the RDS admin.
      options: `-c search_path="${connection.schema}",public`,
      max: 5,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    },
  };
}
