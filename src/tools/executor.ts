import { resolve, relative } from 'path';
import chalk from 'chalk';
import { getTool } from './registry.js';
import { checkPermission } from './permissions.js';
import { startSpinner } from '../ui/spinner.js';
import type { ToolResult } from './types.js';

// Tools that never touch the filesystem — always allowed
const ALWAYS_ALLOW = new Set([
  'read', 'list_dir', 'glob', 'grep',
  'web_fetch', 'web_search', 'http_request',
  'todo_read', 'todo_write',
  'notebook_read',
]);

// File-mutating tools: auto-allow when path is within CWD, ask otherwise
const FILE_TOOLS = new Set(['write', 'edit', 'multi_edit', 'notebook_edit']);

// Shell tool: auto-allow (runs with CWD as working directory)
const SHELL_TOOLS = new Set(['bash']);

function formatToolInput(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'bash':         return `$ ${input['command']}`;
    case 'read':         return `${input['path']}${input['offset'] ? `:${input['offset']}` : ''}`;
    case 'write': {
      const lines = String(input['content'] ?? '').split('\n');
      return `${input['path']}  (${lines.length} lines)`;
    }
    case 'edit':         return `${input['path']}`;
    case 'multi_edit': {
      const edits = Array.isArray(input['edits']) ? input['edits'].length : '?';
      return `${input['path']}  (${edits} edits)`;
    }
    case 'glob':         return `${input['pattern']}`;
    case 'grep':         return `"${input['pattern']}"  in  ${input['path'] ?? '.'}`;
    case 'web_fetch':    return `${input['url']}`;
    case 'web_search':   return `"${input['query']}"`;
    case 'todo_write': {
      const count = Array.isArray(input['todos']) ? input['todos'].length : '?';
      return `${count} items`;
    }
    case 'notebook_read':  return `${input['path']}${input['cell_index'] != null ? `  cell ${input['cell_index']}` : ''}`;
    case 'notebook_edit':  return `${input['path']}  cell ${input['cell_index']}`;
    default:             return JSON.stringify(input).slice(0, 80);
  }
}

function isWithinCwd(filePath: string): boolean {
  const cwd = process.cwd();
  const abs = resolve(cwd, filePath);
  const rel = relative(cwd, abs);
  return !rel.startsWith('..');
}

function cols(): number {
  return Math.min(process.stdout.columns ?? 80, 120);
}

function rule(label: string, color: (s: string) => string = chalk.dim): string {
  const inner = ` ${label} `;
  const remaining = Math.max(0, cols() - inner.length - 2);
  return color(inner + '─'.repeat(remaining));
}

function printOutputLines(lines: string[], isError: boolean): void {
  const c = cols();
  const cap = 40;
  const shown = lines.slice(0, cap);
  const rest = lines.length - shown.length;

  for (const line of shown) {
    const txt = line.slice(0, c - 5);
    process.stdout.write(
      isError
        ? chalk.red(`  │  ${txt}\n`)
        : chalk.dim(`  │  ${txt}\n`),
    );
  }
  if (rest > 0) {
    process.stdout.write(chalk.dim(`  │  … ${rest} more line${rest !== 1 ? 's' : ''}\n`));
  }
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

  // ── permission check ──────────────────────────────────────────────────────
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

  if (opts?.silent) {
    return await tool.execute(input);
  }

  // ── header (running) ──────────────────────────────────────────────────────
  const desc = formatToolInput(toolName, input);
  const stop = startSpinner(`${toolName}  ${desc}`);
  const t0 = Date.now();
  const result = await tool.execute(input);
  stop();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2) + 's';

  if (result.success) {
    // ── success ──────────────────────────────────────────────────────────────
    const headerRight = chalk.dim(elapsed);
    const nameTag = chalk.cyan.bold(toolName);
    const descTag = chalk.white(desc);
    const icon = chalk.green('✓');

    // Top bar: ✓  tool  desc ─── elapsed
    const leftPart = `  ${icon}  ${nameTag}  ${descTag}  `;
    const rawLeft = `     ${toolName}  ${desc}  `;
    const dashCount = Math.max(2, cols() - rawLeft.length - elapsed.length - 1);
    process.stdout.write(`${leftPart}${chalk.dim('─'.repeat(dashCount))}  ${headerRight}\n`);

    // Output lines
    if (result.output) {
      const lines = result.output.split('\n').map((l) => l.trimEnd());
      const nonEmpty = lines.filter((l) => l.length > 0);
      if (nonEmpty.length > 0) {
        printOutputLines(nonEmpty, false);
      }
    }

    process.stdout.write(chalk.dim(`  ${'─'.repeat(cols() - 2)}\n`));
  } else {
    // ── failure ───────────────────────────────────────────────────────────────
    const nameTag = chalk.red.bold(toolName);
    const descTag = chalk.dim(desc);
    const icon = chalk.red('✗');

    const leftPart = `  ${icon}  ${nameTag}  ${descTag}  `;
    const rawLeft = `     ${toolName}  ${desc}  `;
    const dashCount = Math.max(2, cols() - rawLeft.length - elapsed.length - 1);
    process.stdout.write(`${leftPart}${chalk.dim('─'.repeat(dashCount))}  ${chalk.dim(elapsed)}\n`);

    const errText = result.error ?? 'Unknown error';
    const isOsPermErr = errText.includes('EACCES') || errText.includes('EPERM');
    const errLines = isOsPermErr
      ? [`Permission denied: ${input['path'] ?? input['command'] ?? ''}`, 'Check directory permissions or run with elevated privileges.']
      : errText.split('\n').map((l) => l.trimEnd()).filter(Boolean);

    printOutputLines(errLines, true);
    process.stdout.write(chalk.dim(`  ${'─'.repeat(cols() - 2)}\n`));
  }

  return result;
}

export { rule };
