import { type INestApplication, ValidationPipe } from "@nestjs/common";
import type { Env } from "./common/config/env.js";

// Shared between `main.ts` and the integration tests so both exercise the same app configuration.
export function configureApp(app: INestApplication, env: Env): void {
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: env.isLocal ? true : env.allowedOrigins,
    exposedHeaders: ["Content-Disposition"],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
