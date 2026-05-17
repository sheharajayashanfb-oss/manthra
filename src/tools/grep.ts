import { readFileSync, existsSync } from 'fs';
import fg from 'fast-glob';
import type { Tool, ToolResult } from './types.js';

export const grepTool: Tool = {
  name: 'grep',
  description: 'Search for a pattern across files. Returns matching lines with file names and line numbers.',
  input_schema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (string or regex)' },
      path: { type: 'string', description: 'File or directory to search (default: current directory)' },
      include: { type: 'string', description: 'File pattern to include (e.g. "*.ts")' },
      case_insensitive: { type: 'boolean', description: 'Case-insensitive matching (default: false)' },
      max_results: { type: 'number', description: 'Maximum number of results to return (default: 100)' },
    },
    required: ['pattern'],
  },
  async execute(input): Promise<ToolResult> {
    const pattern = input['pattern'] as string;
    const searchPath = (input['path'] as string | undefined) ?? process.cwd();
    const include = (input['include'] as string | undefined) ?? '**/*';
    const caseInsensitive = (input['case_insensitive'] as boolean | undefined) ?? false;
    const maxResults = (input['max_results'] as number | undefined) ?? 100;

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, caseInsensitive ? 'i' : '');
    } catch {
      regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseInsensitive ? 'i' : '');
    }

    let files: string[];
    if (existsSync(searchPath) && !fg.isDynamicPattern(searchPath)) {
      const stat = (await import('fs')).statSync(searchPath);
      files = stat.isFile() ? [searchPath] : await fg(include, { cwd: searchPath, ignore: ['**/node_modules/**', '**/.git/**'], dot: false, onlyFiles: true, absolute: true });
    } else {
      files = await fg(include, { cwd: searchPath, ignore: ['**/node_modules/**', '**/.git/**'], dot: false, onlyFiles: true });
    }

    const matches: string[] = [];
    for (const file of files) {
      if (matches.length >= maxResults) break;
      try {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
          if (regex.test(lines[i])) {
            matches.push(`${file}:${i + 1}: ${lines[i].trim()}`);
          }
        }
      } catch {}
    }

    if (matches.length === 0) return { success: true, output: 'No matches found.' };
    const output = matches.join('\n');
    const truncated = matches.length >= maxResults ? `\n... (results truncated at ${maxResults})` : '';
    return { success: true, output: output + truncated };
  },
};
