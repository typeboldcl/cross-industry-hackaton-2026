import { isProtectedSchema } from "../src/common/database/connection.js";

// Integration tests drop and recreate their schema, so they always run against `<DB_SCHEMA>_test` and never against a schema someone loaded by hand.
export function useTestEnvironment(): void {
  try {
    process.loadEnvFile();
  } catch {
    // In CI the variables come from the environment and there is no .env file.
  }

  if (isProtectedSchema(process.env.DB_SCHEMA ?? "")) {
    throw new Error(
      `DB_SCHEMA=${process.env.DB_SCHEMA}: integration tests never run against a protected schema.`,
    );
  }

  process.env.NODE_ENV = "local";

  const schema = process.env.DB_SCHEMA?.trim();
  if (schema && !schema.endsWith("_test")) {
    process.env.DB_SCHEMA = `${schema}_test`;
  }
}
