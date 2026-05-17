import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const FILENAME = 'MANTHRA.md';

/**
 * Walk from startDir up to 4 parent levels looking for MANTHRA.md.
 * Returns the file content, or null if not found.
 */
export function loadManthraMd(startDir = process.cwd()): string | null {
  let dir = startDir;
  for (let i = 0; i < 4; i++) {
    const candidate = join(dir, FILENAME);
    if (existsSync(candidate)) {
      const content = readFileSync(candidate, 'utf-8').trim();
      return content || null;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return null;
}

export function getManthraMdPath(): string {
  return join(process.cwd(), FILENAME);
}
