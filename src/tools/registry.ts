import type { Tool } from './types.js';
import type { ToolDefinition } from '../providers/types.js';
import { bashTool } from './bash.js';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { fileEditTool } from './file-edit.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { webFetchTool } from './web-fetch.js';
import { listDirTool } from './list-dir.js';
import { httpRequestTool } from './http-request.js';

const tools = new Map<string, Tool>([
  [bashTool.name, bashTool],
  [fileReadTool.name, fileReadTool],
  [fileWriteTool.name, fileWriteTool],
  [fileEditTool.name, fileEditTool],
  [globTool.name, globTool],
  [grepTool.name, grepTool],
  [webFetchTool.name, webFetchTool],
  [listDirTool.name, listDirTool],
  [httpRequestTool.name, httpRequestTool],
]);

export function getTool(name: string): Tool | undefined {
  return tools.get(name);
}

export function getAllTools(): Tool[] {
  return Array.from(tools.values());
}

export function getToolDefinitions(): ToolDefinition[] {
  return getAllTools().map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
