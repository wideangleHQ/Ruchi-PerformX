import { defineConfig } from 'vitest/config';

// ponytail: no fixtures, no test database, no coverage gate. Tests here cover
// the paths where a bug is silent and expensive: leave balance arithmetic,
// the vendor allowlist, asset encryption, and this channel map. Everything
// else is covered by tsc and forbidNonWhitelisted.
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // Two constants files throw at import time when their secret is missing, so
    // a spec that touches them needs the variable set before the import runs.
    // Fixed values keep the suite hermetic; no test uses the real secrets.
    env: {
      JWT_SECRET: 'test-jwt-secret',
      VMS_JWT_SECRET: 'test-vms-jwt-secret',
    },
  },
});
