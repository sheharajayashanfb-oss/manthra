import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Tool, ToolResult } from './types.js';

interface Edit {
  old_string: string;
  new_string: string;
}

export const multiEditTool: Tool = {
  name: 'multi_edit',
  description: 'Apply multiple edits to a single file atomically. Each edit replaces an exact string that must appear exactly once. Edits are applied in order — later edits operate on the result of earlier ones. Read the file first.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path (relative paths resolve to the current working directory)',
      },
      edits: {
        type: 'array',
        description: 'List of edits to apply in order',
        items: {
          type: 'object',
          properties: {
            old_string: { type: 'string', description: 'Exact string to find (must be unique in the file at that point)' },
            new_string: { type: 'string', description: 'Replacement string' },
          },
          required: ['old_string', 'new_string'],
        },
      },
    },
    required: ['path', 'edits'],
  },
  async execute(input): Promise<ToolResult> {
    if (typeof input['path'] !== 'string' || !input['path']) {
      return { success: false, output: '', error: 'path is required and must be a string' };
    }
    if (!Array.isArray(input['edits']) || input['edits'].length === 0) {
      return { success: false, output: '', error: 'edits must be a non-empty array' };
    }

    const filePath = resolve(process.cwd(), input['path'] as string);

    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `File not found: ${filePath}` };
    }

    try {
      let content = readFileSync(filePath, 'utf-8');
      const edits = input['edits'] as Edit[];

      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        if (typeof edit.old_string !== 'string') {
          return { success: false, output: '', error: `edits[${i}].old_string must be a string` };
        }
        if (typeof edit.new_string !== 'string') {
          return { success: false, output: '', error: `edits[${i}].new_string must be a string` };
        }

        const occurrences = content.split(edit.old_string).length - 1;
        if (occurrences === 0) {
          return {
            success: false,
            output: '',
            error: `edits[${i}]: old_string not found in file: ${edit.old_string.slice(0, 60)}${edit.old_string.length > 60 ? '…' : ''}`,
          };
        }
        if (occurrences > 1) {
          return {
            success: false,
            output: '',
            error: `edits[${i}]: old_string appears ${occurrences} times — provide more context to make it unique`,
          };
        }

        // Literal replacement — split/join avoids $& $' $$ special patterns in new_string
        content = content.split(edit.old_string).join(edit.new_string);
      }

      writeFileSync(filePath, content, 'utf-8');
      return { success: true, output: `Applied ${edits.length} edit${edits.length === 1 ? '' : 's'} to ${filePath}` };
    } catch (err: unknown) {
      return { success: false, output: '', error: String(err) };
    }
  },
};
