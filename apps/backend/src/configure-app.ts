import type { INestApplication } from "@nestjs/common";

// Shared between `main.ts` and the e2e tests so both exercise the same app configuration.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix("api");
  app.enableCors();
}
