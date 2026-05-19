import { exec } from 'child_process';
import { promisify } from 'util';
import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import type { Tool, ToolResult } from './types.js';

const execAsync = promisify(exec);

function resolvePath(p: string): string {
  return resolve(process.cwd(), p);
}

/**
 * Recursively walk a directory and yield file paths matching a glob-like pattern.
 * Supports patterns like **\/*.ts, *.json, src/**\/*.js
 */
function matchGlob(pattern: string, basePath: string): string[] {
  const results: string[] = [];

  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex special chars (not * or ?)
    .replace(/\\\*/g, '__STAR__')
    .replace(/__STAR____STAR__\//g, '(?:.+/)?')
    .replace(/__STAR____STAR__/g, '.*')
    .replace(/__STAR__/g, '[^/]*')
    .replace(/\?/g, '[^/]');

  const regex = new RegExp(`^${regexStr}$`);

  function walk(dir: string, relative: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
      const fullPath = join(dir, name);
      const relPath = relative ? `${relative}/${name}` : name;
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(fullPath, relPath);
      } else {
        if (regex.test(relPath)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(basePath, '');
  return results;
}

const grepSearchTool: Tool = {
  name: 'grep_search',
  description: 'Search for a pattern in files using grep, returns matching lines with file and line number',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'The regex or string pattern to search for' },
      path: { type: 'string', description: 'Directory or file path to search in (default: current directory)' },
    },
    required: ['pattern'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const pattern = String(input['pattern']);
      const searchPath = input['path'] ? resolvePath(String(input['path'])) : process.cwd();
      const cmd = `grep -r -n --include="*" -l "${pattern.replace(/"/g, '\\"')}" "${searchPath}" 2>/dev/null | head -20`;

      // First find matching files, then get lines
      const grepCmd = `grep -r -n "${pattern.replace(/"/g, '\\"')}" "${searchPath}" 2>/dev/null | head -100`;
      const { stdout, stderr } = await execAsync(grepCmd, { cwd: process.cwd() });
      const output = stdout.trim();
      if (!output) {
        return { success: true, output: `No matches found for pattern: ${pattern}` };
      }
      return { success: true, output };
    } catch (err: unknown) {
      // grep returns exit code 1 when no matches found
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === '1') {
        return { success: true, output: 'No matches found' };
      }
      return { success: false, output: '', error: String(err) };
    }
  },
};

const globSearchTool: Tool = {
  name: 'glob_search',
  description: 'Find files matching a glob pattern (e.g., **/*.ts, src/*.json)',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern to match files against (e.g., **/*.ts)' },
    },
    required: ['pattern'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const pattern = String(input['pattern']);
      const matches = matchGlob(pattern, process.cwd());
      if (matches.length === 0) {
        return { success: true, output: `No files found matching: ${pattern}` };
      }
      const cwd = process.cwd();
      const relative = matches.map((f) => f.startsWith(cwd) ? f.slice(cwd.length + 1) : f);
      return { success: true, output: relative.join('\n') };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

const searchSymbolTool: Tool = {
  name: 'search_symbol',
  description: 'Search for a symbol definition (function, class, const, interface) in the codebase',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'The symbol name to search for (function/class/const/interface name)' },
    },
    required: ['symbol'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const symbol = String(input['symbol']);
      // Match function/class/const/interface/type/let/var declarations
      const pattern = `(function|class|const|interface|type|let|var|async function|export function|export class|export const|export interface|export type|export default function|export default class)\\s+${symbol}[\\s(<{=:]`;
      const cmd = `grep -r -n -E "${pattern.replace(/"/g, '\\"')}" "${process.cwd()}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.go" --include="*.rs" 2>/dev/null | head -50`;
      const { stdout } = await execAsync(cmd, { cwd: process.cwd() });
      const output = stdout.trim();
      if (!output) {
        return { success: true, output: `No definition found for symbol: ${symbol}` };
      }
      return { success: true, output };
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === '1') {
        return { success: true, output: 'No matches found' };
      }
      return { success: false, output: '', error: String(err) };
    }
  },
};

export const searchTools: Tool[] = [
  grepSearchTool,
  globSearchTool,
  searchSymbolTool,
];
