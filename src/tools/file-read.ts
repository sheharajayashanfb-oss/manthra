import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import type { Tool, ToolResult } from './types.js';

export const fileReadTool: Tool = {
  name: 'read',
  description: 'Read the contents of a file. Optionally specify a line range.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path (relative paths resolve to the current working directory)' },
      offset: { type: 'number', description: 'Starting line number (1-based, optional)' },
      limit: { type: 'number', description: 'Number of lines to read (optional)' },
    },
    required: ['path'],
  },
  async execute(input): Promise<ToolResult> {
    if (typeof input['path'] !== 'string' || !input['path']) {
      return { success: false, output: '', error: 'path is required and must be a string' };
    }
    const filePath = resolve(process.cwd(), input['path']);
    const rawOffset = input['offset'];
    const rawLimit = input['limit'];
    const offset = rawOffset !== undefined ? (typeof rawOffset === 'number' ? rawOffset : 1) : 1;
    const limit = rawLimit !== undefined ? (typeof rawLimit === 'number' ? rawLimit : undefined) : undefined;

    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `File not found: ${filePath}. The file does not exist. To create it, use the write tool instead of retrying read.` };
    }

    try {
      const stat = statSync(filePath);
      if (stat.isDirectory()) {
        return { success: false, output: '', error: `${filePath} is a directory, not a file` };
      }
      if (stat.size > 5 * 1024 * 1024) {
        return { success: false, output: '', error: `File too large (${Math.round(stat.size / 1024)}KB). Use offset/limit to read specific sections.` };
      }

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const startLine = Math.max(0, offset - 1);
      const endLine = limit !== undefined ? startLine + limit : lines.length;
      const selected = lines.slice(startLine, endLine);

      const numbered = selected.map((line, i) => `${startLine + i + 1}\t${line}`).join('\n');
      return { success: true, output: numbered };
    } catch (err: unknown) {
      return { success: false, output: '', error: String(err) };
    }
  },
};
