export type RuntimeEnvironment = "local" | "development" | "production";

const ENVIRONMENTS: readonly RuntimeEnvironment[] = [
  "local",
  "development",
  "production",
];

export interface DatabaseConnection {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
  sslCa: string | null;
}

export interface StorageSettings {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string | null;
  secretKey: string | null;
}

export interface LlmSettings {
  baseUrl: string;
  apiKey: string | null;
  smallModel: string;
  largeModel: string;
  concurrency: number;
  timeoutMs: number;
}

export interface Env {
  environment: RuntimeEnvironment;
  isLocal: boolean;
  port: number;
  host: string;
  allowedOrigins: string[];
  database: DatabaseConnection;
  storage: StorageSettings;
  llm: LlmSettings;
  ollamaBaseUrl: string;
  seiaBaseUrl: string;
}

export const ENV = Symbol("ENV");

export class EnvError extends Error {}

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const environment = readEnvironment(source);
  const isLocal = environment === "local";
  const sslCa = read(source, "DB_SSL_CA") ?? null;

  if (!isLocal && !sslCa) {
    throw new EnvError(
      `NODE_ENV=${environment} requires DB_SSL_CA: outside local the database certificate is always verified.`,
    );
  }

  return {
    environment,
    isLocal,
    port: readInteger(source, "PORT", 3000),
    host: read(source, "HOST") ?? "0.0.0.0",
    allowedOrigins: readList(source, "ALLOWED_ORIGINS"),
    database: {
      host: required(source, "DB_HOST"),
      port: readInteger(source, "DB_PORT", 5432),
      username: required(source, "DB_USERNAME"),
      password: required(source, "DB_PASSWORD"),
      database: required(source, "DB_DATABASE"),
      schema: required(source, "DB_SCHEMA"),
      sslCa,
    },
    storage: {
      endpoint:
        read(source, "OBS_ENDPOINT") ??
        "https://obs.la-south-2.myhuaweicloud.com",
      region: read(source, "OBS_REGION") ?? "la-south-2",
      bucket: read(source, "OBS_BUCKET") ?? "rca-hackaton",
      accessKey: read(source, "OBS_AK") ?? null,
      secretKey: read(source, "OBS_SK") ?? null,
    },
    llm: {
      baseUrl:
        read(source, "ORBIT_BASE_URL") ??
        "https://orbit.dev.core.axmos.tech/openai",
      apiKey: read(source, "ORBIT_API_KEY") ?? null,
      smallModel: read(source, "LLM_MODEL_SMALL") ?? "glm-5.3",
      largeModel: read(source, "LLM_MODEL_LARGE") ?? "glm-5.3",
      concurrency: readInteger(source, "LLM_CONCURRENCY", 2),
      timeoutMs: readInteger(source, "LLM_TIMEOUT_MS", 300_000),
    },
    ollamaBaseUrl: read(source, "OLLAMA_BASE_URL") ?? "http://localhost:11434",
    seiaBaseUrl: read(source, "SEIA_BASE_URL") ?? "https://seia.sea.gob.cl",
  };
}

function readEnvironment(source: NodeJS.ProcessEnv): RuntimeEnvironment {
  const environment = read(source, "NODE_ENV") ?? "local";

  if (!ENVIRONMENTS.includes(environment as RuntimeEnvironment)) {
    throw new EnvError(
      `Invalid NODE_ENV "${environment}". Allowed values: ${ENVIRONMENTS.join(", ")}.`,
    );
  }

  return environment as RuntimeEnvironment;
}

// An env file written by a deployment lists every name, so an unset variable arrives as an empty string and must fall back like an absent one.
function read(source: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = source[name]?.trim();
  return value ? value : undefined;
}

function required(source: NodeJS.ProcessEnv, name: string): string {
  const value = read(source, name);

  if (!value) {
    throw new EnvError(`Missing environment variable ${name}.`);
  }

  return value;
}

function readInteger(
  source: NodeJS.ProcessEnv,
  name: string,
  byDefault: number,
): number {
  const value = read(source, name);

  if (value === undefined) {
    return byDefault;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new EnvError(`${name} must be a positive integer, got "${value}".`);
  }

  return parsed;
}

function readList(source: NodeJS.ProcessEnv, name: string): string[] {
  return (read(source, name) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
