import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true,           // Auto-transform payloads to DTO instances
    }),
  );

  // CORS. `CORS_ORIGINS` is a comma-separated allowlist; the default is the
  // local client plus the production domain, so nothing has to be set for
  // local development or for the deploy that has always worked.
  //
  // Env-driven rather than hardcoded because a browser rejects a disallowed
  // origin at the preflight, before the request reaches this process. There is
  // no server log and no error body: the screen simply fails. A new client
  // domain, a Vercel preview URL or a staging host should be one variable on
  // the API host, not a code change and a redeploy.
  //
  // Deliberately not in `server_env_required`. It has a working default, so a
  // missing value cannot fail quietly, which is the thing that list guards
  // against. See docs/src/p1_setup.md.
  const corsOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:4001,https://app.ruchiperformx.in'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  console.log(`RUCHI PerformX API running on port ${port}`);
}

bootstrap();