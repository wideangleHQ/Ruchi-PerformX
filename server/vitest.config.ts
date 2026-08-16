import { defineConfig } from 'vitest/config';

// ponytail: no fixtures, no test database, no coverage gate. Tests here cover
// the paths where a bug is silent and expensive: leave balance arithmetic,
// the vendor allowlist, asset encryption, and this channel map. Everything
// else is covered by tsc and forbidNonWhitelisted.
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
