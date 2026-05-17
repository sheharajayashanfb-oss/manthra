import { readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import type { Tool, ToolResult } from './types.js';

export const listDirTool: Tool = {
  name: 'list_dir',
  description: 'List the contents of a directory.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to list (default: current directory)' },
    },
    required: [],
  },
  async execute(input): Promise<ToolResult> {
    const dirPath = resolve(process.cwd(), (input['path'] as string | undefined) ?? '.');
    if (!existsSync(dirPath)) {
      return { success: false, output: '', error: `Directory not found: ${dirPath}` };
    }
    try {
      const entries = readdirSync(dirPath);
      const lines = entries.map((name) => {
        const fullPath = join(dirPath, name);
        try {
          const stat = statSync(fullPath);
          return stat.isDirectory() ? `${name}/` : name;
        } catch {
          return name;
        }
      });
      return { success: true, output: lines.join('\n') };
    } catch (err: unknown) {
      return { success: false, output: '', error: String(err) };
    }
  },
};
