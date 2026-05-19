import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  mkdirSync,
} from 'fs';
import { resolve, dirname, join } from 'path';
import type { Tool, ToolResult } from './types.js';

function resolvePath(p: string): string {
  return resolve(process.cwd(), p);
}

const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file, optionally with line offset and limit',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to read (relative or absolute)' },
      offset: { type: 'number', description: 'Line number to start reading from (1-based, optional)' },
      limit: { type: 'number', description: 'Maximum number of lines to read (optional)' },
    },
    required: ['path'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const filePath = resolvePath(String(input['path']));
      const raw = readFileSync(filePath, 'utf-8');
      const allLines = raw.split('\n');

      const offset = input['offset'] != null ? Math.max(1, Number(input['offset'])) : 1;
      const limit = input['limit'] != null ? Number(input['limit']) : allLines.length;

      const startIdx = offset - 1;
      const selectedLines = allLines.slice(startIdx, startIdx + limit);

      const numbered = selectedLines.map((line, i) => `${startIdx + i + 1}\t${line}`).join('\n');
      const note = allLines.length > startIdx + limit
        ? `\n\n(${allLines.length - startIdx - limit} more lines not shown)`
        : '';

      return { success: true, output: numbered + note };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Write or create a file with the given content',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write (relative or absolute)' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const filePath = resolvePath(String(input['path']));
      const content = String(input['content']);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, 'utf-8');
      return { success: true, output: `File written: ${filePath} (${content.length} chars)` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

const editFileTool: Tool = {
  name: 'edit_file',
  description: 'Edit a file by replacing a specific string with a new string',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to edit' },
      old_string: { type: 'string', description: 'The exact string to find and replace' },
      new_string: { type: 'string', description: 'The replacement string' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const filePath = resolvePath(String(input['path']));
      const oldStr = String(input['old_string']);
      const newStr = String(input['new_string']);

      const original = readFileSync(filePath, 'utf-8');

      // Use split/join instead of String.replace to avoid $ special chars
      const parts = original.split(oldStr);
      if (parts.length < 2) {
        return { success: false, output: '', error: `String not found in file: ${JSON.stringify(oldStr.slice(0, 80))}` };
      }
      if (parts.length > 2) {
        return { success: false, output: '', error: `String appears ${parts.length - 1} times in file — be more specific` };
      }

      const updated = parts[0] + newStr + parts[1];
      writeFileSync(filePath, updated, 'utf-8');
      return { success: true, output: `File edited: ${filePath}` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

const listFilesTool: Tool = {
  name: 'list_files',
  description: 'List the contents of a directory',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to list (relative or absolute)' },
    },
    required: ['path'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const dirPath = resolvePath(String(input['path']));
      const entries = readdirSync(dirPath);
      const MAX = 200;
      const shown = entries.slice(0, MAX);

      const lines = shown.map((name) => {
        try {
          const stat = statSync(join(dirPath, name));
          return stat.isDirectory() ? `${name}/` : name;
        } catch {
          return name;
        }
      });

      const note = entries.length > MAX ? `\n(${entries.length - MAX} more entries not shown)` : '';
      return { success: true, output: lines.join('\n') + note };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

const deleteFileTool: Tool = {
  name: 'delete_file',
  description: 'Delete a file (not directories)',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to delete' },
    },
    required: ['path'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const filePath = resolvePath(String(input['path']));
      const stat = statSync(filePath);
      if (stat.isDirectory()) {
        return { success: false, output: '', error: 'Cannot delete a directory with this tool. Use shell commands for directory removal.' };
      }
      unlinkSync(filePath);
      return { success: true, output: `Deleted: ${filePath}` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

export const fsTools: Tool[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  listFilesTool,
  deleteFileTool,
];
