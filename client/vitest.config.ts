import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

// tsconfig maps `@/*` to both `./*` and `./src/*`, in that order, so the
// shadcn primitives in ./components/ui and everything under ./src both resolve
// from the same prefix. Vite's alias can only point at one directory, hence a
// resolver that tries the two the way tsc does.
const EXTENSIONS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

function tsconfigAlias(): Plugin {
  return {
    name: 'tsconfig-at-alias',
    enforce: 'pre',
    resolveId(source) {
      if (!source.startsWith('@/')) return null;
      const rest = source.slice(2);
      for (const base of ['.', 'src']) {
        for (const extension of EXTENSIONS) {
          const candidate = resolve(__dirname, base, rest + extension);
          if (existsSync(candidate) && /\.\w+$/.test(candidate)) return candidate;
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [tsconfigAlias()],
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
