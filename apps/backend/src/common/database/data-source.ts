import { DataSource } from "typeorm";
import { readEnv } from "../config/env.js";
import { postgresOptions } from "./connection.js";
import { ENTITIES } from "./entities.js";
import { MIGRATIONS } from "./migrations/index.js";

const env = readEnv();

export const dataSource = new DataSource({
  ...postgresOptions(env.database, env.isLocal),
  entities: ENTITIES,
  migrations: MIGRATIONS,
});
