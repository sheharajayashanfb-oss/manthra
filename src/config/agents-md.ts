import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';

const FILENAME = 'AGENTS.md';

// ── @import resolution ────────────────────────────────────────────────────────

function readWithImports(filePath: string, visited = new Set<string>()): string {
  const abs = resolve(filePath);
  if (visited.has(abs)) return ''; // circular import guard
  visited.add(abs);

  let content: string;
  try {
    content = readFileSync(abs, 'utf-8');
  } catch {
    return '';
  }

  const baseDir = dirname(abs);

  // Process lines: @path/to/file imports the file inline
  return content
    .split('\n')
    .map((line) => {
      const match = line.match(/^@(.+)$/);
      if (!match) return line;
      const importPath = match[1].trim();
      const resolved = resolve(baseDir, importPath);
      if (!existsSync(resolved)) return `<!-- @${importPath}: not found -->`;
      return readWithImports(resolved, visited);
    })
    .join('\n');
}

// ── project root detection ────────────────────────────────────────────────────

const ROOT_MARKERS = ['.git', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'composer.json'];

function findProjectRoot(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 12; i++) {
    if (ROOT_MARKERS.some((m) => existsSync(join(dir, m)))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ── public API ────────────────────────────────────────────────────────────────

export interface AgentsMdResult {
  /** Merged content of all loaded AGENTS.md files, or empty string if none. */
  content: string;
  /** Absolute paths of every file that was loaded, in priority order. */
  sources: string[];
}

/**
 * Load AGENTS.md from three levels — exactly how Claude Code loads CLAUDE.md:
 *
 *   1. Global:  ~/.manthra/AGENTS.md           (user-wide instructions)
 *   2. Project: <project-root>/AGENTS.md        (repo-level instructions)
 *   3. Local:   <cwd>/AGENTS.md                 (directory-level instructions)
 *
 * Each file may contain `@relative/path` lines to import other files.
 * All found files are merged in order (global → project → local).
 */
export function loadAgentsMd(startDir = process.cwd()): AgentsMdResult {
  const seen = new Set<string>();
  const sources: string[] = [];
  const sections: string[] = [];

  const tryLoad = (filePath: string) => {
    const abs = resolve(filePath);
    if (seen.has(abs) || !existsSync(abs)) return;
    seen.add(abs);
    const content = readWithImports(abs).trim();
    if (!content) return;
    sources.push(abs);
    sections.push(content);
  };

  // 1. Global user instructions
  tryLoad(join(homedir(), '.manthra', FILENAME));

  // 2. Project-root instructions (if different from CWD)
  const projectRoot = findProjectRoot(startDir);
  if (projectRoot && projectRoot !== startDir) {
    tryLoad(join(projectRoot, FILENAME));
  }

  // 3. CWD instructions
  tryLoad(join(startDir, FILENAME));

  return {
    content: sections.join('\n\n---\n\n'),
    sources,
  };
}

/** Canonical path for creating a new AGENTS.md in the current project. */
export function getAgentsMdPath(): string {
  return join(process.cwd(), FILENAME);
}
