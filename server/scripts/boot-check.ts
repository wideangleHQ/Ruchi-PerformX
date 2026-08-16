import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

/**
 * Builds the Nest dependency container and stops.
 *
 * Nest instantiates the global JwtAuthGuard and RolesGuard inside whichever
 * module owns each controller, so that module needs JwtService in scope. A
 * module registering a controller without AuthModule in its imports
 * typechecks, passes every test, and then fails at boot with "Nest can't
 * resolve dependencies of the JwtAuthGuard". Only building the container
 * catches it, which is why this exists as a check rather than a test.
 *
 * NestFactory.create resolves the whole graph and returns before
 * onModuleInit, so no database is touched. The two modules that read
 * environment variables at import time still need them present; CI passes
 * dummies.
 */
NestFactory.create(AppModule, { logger: false })
  .then(async (app) => {
    console.log('BOOT_OK');
    await app.close();
    process.exit(0);
  })
  .catch((e: unknown) => {
    console.log('BOOT_FAILED');
    console.log(e instanceof Error ? e.message.split('\n')[0] : String(e));
    process.exit(1);
  });
