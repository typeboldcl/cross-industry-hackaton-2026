import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { ENV, type Env } from "./common/config/env.js";
import { configureApp } from "./configure-app.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get<Env>(ENV);
  configureApp(app, env);
  await app.listen(env.port, env.host);
}

await bootstrap();
