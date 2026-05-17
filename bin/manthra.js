#!/usr/bin/env node
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distMain = join(__dirname, '../dist/cli/main.js');
const srcMain = join(__dirname, '../src/cli/main.ts');
const tsx = join(__dirname, '../node_modules/.bin/tsx');

if (existsSync(distMain)) {
  // Run built version
  await import(distMain);
} else if (existsSync(tsx)) {
  // Dev mode: run TypeScript source via tsx
  const proc = spawn(tsx, [srcMain, ...process.argv.slice(2)], { stdio: 'inherit' });
  proc.on('exit', (code) => process.exit(code ?? 0));
} else {
  console.error('Error: Run "npm install" first, then "npm run build" or "npm link".');
  process.exit(1);
}
