import { resolve, relative } from 'path';
import chalk from 'chalk';
import { getTool } from './registry.js';
import { checkPermission } from './permissions.js';
import { startSpinner } from '../ui/spinner.js';
import type { ToolResult } from './types.js';

// Tools that never touch the filesystem — always allowed
const ALWAYS_ALLOW = new Set(['read', 'list_dir', 'glob', 'grep', 'web_fetch', 'http_request']);

// File-mutating tools: auto-allow when path is within CWD, ask otherwise
const FILE_TOOLS = new Set(['write', 'edit']);

// Shell tool: auto-allow (runs with CWD as working directory)
const SHELL_TOOLS = new Set(['bash']);

function formatToolInput(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'bash':      return `$ ${input['command']}`;
    case 'read':      return `${input['path']}${input['offset'] ? `:${input['offset']}` : ''}`;
    case 'write':     return `→ ${input['path']} (${String(input['content']).length} chars)`;
    case 'edit':      return `${input['path']}: "${String(input['old_string']).slice(0, 40)}…"`;
    case 'glob':      return `${input['pattern']}`;
    case 'grep':      return `"${input['pattern']}" in ${input['path'] ?? '.'}`;
    case 'web_fetch': return `${input['url']}`;
    default:          return JSON.stringify(input);
  }
}

function isWithinCwd(filePath: string): boolean {
  const cwd = process.cwd();
  const abs = resolve(cwd, filePath);
  const rel = relative(cwd, abs);
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

  // ── permission check (before spinner — may prompt user) ──────────────────
  let allowed = false;

  if (ALWAYS_ALLOW.has(toolName)) {
    allowed = true;
  } else if (FILE_TOOLS.has(toolName)) {
    const filePath = input['path'] as string | undefined;
    allowed = (filePath && isWithinCwd(filePath))
      ? true
      : await checkPermission(toolName, input, (i) => formatToolInput(toolName, i));
  } else if (SHELL_TOOLS.has(toolName)) {
    allowed = true;
  } else {
    allowed = await checkPermission(toolName, input, (i) => formatToolInput(toolName, i));
  }

  if (!allowed) {
    return { success: false, output: '', error: 'Permission denied by user' };
  }

  // ── run with spinner ──────────────────────────────────────────────────────
  if (opts?.silent) {
    return await tool.execute(input);
  }

  const desc = formatToolInput(toolName, input);
  const stop = startSpinner(`${toolName}  ${desc}`);
  const result = await tool.execute(input);
  stop();

  if (result.success) {
    process.stdout.write(chalk.dim(`  ✓  ${toolName}  ${desc}\n`));
    // Show up to 3 non-empty lines of output as a preview
    const preview = result.output
      .split('\n')
      .map(l => l.trimEnd())
      .filter(l => l.length > 0)
      .slice(0, 3);
    for (const line of preview) {
      process.stdout.write(chalk.dim(`     ${line.slice(0, 120)}\n`));
    }
  } else {
    const isOsPermErr = result.error?.includes('EACCES') || result.error?.includes('EPERM');
    if (isOsPermErr) {
      process.stdout.write(chalk.red(`  ✗  Permission denied: ${input['path'] ?? input['command'] ?? ''}\n`));
      process.stdout.write(chalk.dim(`     Check directory permissions or run with elevated privileges.\n`));
    } else {
      process.stdout.write(chalk.red(`  ✗  ${toolName}  ${result.error}\n`));
    }
  }

  return result;
}
