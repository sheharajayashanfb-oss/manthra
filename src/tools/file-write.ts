import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import type { Tool, ToolResult } from './types.js';

export const fileWriteTool: Tool = {
  name: 'write',
  description: 'Write content to a file, creating parent directories if needed. Relative paths resolve to the current working directory. This overwrites existing content.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path (relative paths resolve to the current working directory)' },
      content: { type: 'string', description: 'The content to write' },
    },
    required: ['path', 'content'],
  },
  async execute(input): Promise<ToolResult> {
    const filePath = resolve(process.cwd(), input['path'] as string);
    const content = input['content'] as string;

    try {
      const dir = dirname(filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, content, 'utf-8');
      return { success: true, output: `Written to ${filePath}` };
    } catch (err: unknown) {
      return { success: false, output: '', error: String(err) };
    }
  },
};
