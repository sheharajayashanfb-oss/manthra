import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'cli/main': 'src/cli/main.ts' },
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    external: ['@anthropic-ai/sdk', 'openai', '@google/generative-ai'],
  },
  {
    entry: { 'web/server': 'src/web/server.ts' },
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    sourcemap: true,
    external: ['express', 'cors'],
  },
]);
