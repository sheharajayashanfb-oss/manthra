import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

export default defineConfig({
  entry: { manthra: 'src/cli/main.ts' },
  format: ['cjs'],
  target: 'node18',
  outDir: 'dist-pkg',
  bundle: true,
  sourcemap: false,
  shims: true,          // inject import.meta.url and __dirname shims for CJS
  noExternal: [/.*/],   // inline every dependency so pkg produces a self-contained binary
  define: {
    'process.env.APP_VERSION': JSON.stringify(version),
  },
});
