import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Tool, ToolResult } from './types.js';

export const fileEditTool: Tool = {
  name: 'edit',
  description: 'Replace an exact string in a file with a new string. The old_string must appear exactly once in the file. Read the file first before editing.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path (relative paths resolve to the current working directory)' },
      old_string: { type: 'string', description: 'The exact string to find and replace (must be unique in the file)' },
      new_string: { type: 'string', description: 'The replacement string' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  async execute(input): Promise<ToolResult> {
    if (typeof input['path'] !== 'string' || !input['path']) {
      return { success: false, output: '', error: 'path is required and must be a string' };
    }
    if (typeof input['old_string'] !== 'string') {
      return { success: false, output: '', error: 'old_string is required and must be a string' };
    }
    if (typeof input['new_string'] !== 'string') {
      return { success: false, output: '', error: 'new_string is required and must be a string' };
    }
    const filePath = resolve(process.cwd(), input['path']);
    const oldStr = input['old_string'];
    const newStr = input['new_string'];

    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `File not found: ${filePath}` };
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const occurrences = content.split(oldStr).length - 1;
      if (occurrences === 0) {
        return { success: false, output: '', error: 'old_string not found in file' };
      }
      if (occurrences > 1) {
        return { success: false, output: '', error: `old_string appears ${occurrences} times. Provide more context to make it unique.` };
      }
      // split/join does a literal replacement — avoids String.replace() treating
      // $& $` $' $$ in newStr as special replacement patterns
      const updated = content.split(oldStr).join(newStr);
      writeFileSync(filePath, updated, 'utf-8');
      return { success: true, output: `Edited ${filePath}` };
    } catch (err: unknown) {
      return { success: false, output: '', error: String(err) };
    }
  },
};
