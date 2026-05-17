import fg from 'fast-glob';
import type { Tool, ToolResult } from './types.js';

export const globTool: Tool = {
  name: 'glob',
  description: 'Find files matching a glob pattern. Returns a list of matching file paths.',
  input_schema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g. "src/**/*.ts", "**/*.test.js")' },
      cwd: { type: 'string', description: 'Directory to search from (default: current directory)' },
      ignore: { type: 'array', items: { type: 'string' }, description: 'Patterns to ignore' },
    },
    required: ['pattern'],
  },
  async execute(input): Promise<ToolResult> {
    const pattern = input['pattern'] as string;
    const cwd = (input['cwd'] as string | undefined) ?? process.cwd();
    const ignore = (input['ignore'] as string[] | undefined) ?? ['**/node_modules/**', '**/.git/**', '**/dist/**'];

    try {
      const files = await fg(pattern, { cwd, ignore, dot: false, onlyFiles: true });
      if (files.length === 0) return { success: true, output: 'No files found matching pattern.' };
      return { success: true, output: files.join('\n') };
    } catch (err: unknown) {
      return { success: false, output: '', error: String(err) };
    }
  },
};
