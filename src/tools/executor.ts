import { resolve, relative } from 'path';
import chalk from 'chalk';
import { getTool } from './registry.js';
import { checkPermission } from './permissions.js';
import type { ToolResult } from './types.js';

// Tools that never touch the filesystem — always allowed
const ALWAYS_ALLOW = new Set(['read', 'list_dir', 'glob', 'grep', 'web_fetch', 'http_request']);

// File-mutating tools: auto-allow when path is within CWD, ask otherwise
const FILE_TOOLS = new Set(['write', 'edit']);

// Shell tool: auto-allow (runs with CWD as working directory)
const SHELL_TOOLS = new Set(['bash']);

function formatToolInput(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'bash':  return `$ ${input['command']}`;
    case 'read':  return `${input['path']}${input['offset'] ? `:${input['offset']}` : ''}`;
    case 'write': return `→ ${input['path']} (${String(input['content']).length} chars)`;
    case 'edit':  return `${input['path']}: replace "${String(input['old_string']).slice(0, 40)}..."`;
    case 'glob':  return `${input['pattern']}`;
    case 'grep':  return `"${input['pattern']}" in ${input['path'] ?? '.'}`;
    case 'web_fetch': return `${input['url']}`;
    default: return JSON.stringify(input);
  }
}

function isWithinCwd(filePath: string): boolean {
  const cwd = process.cwd();
  const abs = resolve(cwd, filePath);
  const rel = relative(cwd, abs);
  // If rel starts with '..', the path escapes the CWD
  return !rel.startsWith('..');
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  opts?: { silent?: boolean },
): Promise<ToolResult> {
  const tool = getTool(toolName);
  if (!tool) {
    return { success: false, output: '', error: `Unknown tool: ${toolName}` };
  }

  let allowed = false;

  if (ALWAYS_ALLOW.has(toolName)) {
    allowed = true;
  } else if (FILE_TOOLS.has(toolName)) {
    const filePath = input['path'] as string | undefined;
    if (filePath && isWithinCwd(filePath)) {
      allowed = true; // within project directory — auto-allow
    } else {
      // Outside CWD — ask permission
      allowed = await checkPermission(toolName, input, (i) => formatToolInput(toolName, i));
    }
  } else if (SHELL_TOOLS.has(toolName)) {
    // bash always runs with cwd: process.cwd() — auto-allow
    allowed = true;
  } else {
    allowed = await checkPermission(toolName, input, (i) => formatToolInput(toolName, i));
  }

  if (!allowed) {
    return { success: false, output: '', error: 'Permission denied by user' };
  }

  if (!opts?.silent) {
    console.log(chalk.dim(`\n  ⚙  ${toolName}: ${formatToolInput(toolName, input)}`));
  }

  const result = await tool.execute(input);

  if (!opts?.silent) {
    if (result.success) {
      const preview = result.output.slice(0, 200);
      const hasMore = result.output.length > 200;
      console.log(chalk.dim(`  ✓  ${preview}${hasMore ? '...' : ''}`));
    } else {
      // Surface OS permission errors clearly
      const isPermissionError = result.error?.includes('EACCES') || result.error?.includes('EPERM');
      if (isPermissionError) {
        console.log(chalk.red(`  ✗  Permission denied: ${input['path'] ?? input['command'] ?? ''}`));
        console.log(chalk.dim(`      You may need to run with elevated privileges or check directory permissions.`));
      } else {
        console.log(chalk.red(`  ✗  ${result.error}`));
      }
    }
  }

  return result;
}
