import chalk from 'chalk';
import { getTool } from './registry.js';
import type { ToolResult } from './types.js';
import { classifyToolCall, isSessionAllowed, grantSession } from '../permissions/index.js';
import type { PermissionDecision } from '../permissions/index.js';
import { isProjectAllowed, grantProject } from '../permissions/project.js';

// Set by REPL to handle interactive permission prompts
type PermissionFn = (category: string, label: string, detail: string) => Promise<PermissionDecision>;
let _permissionFn: PermissionFn | null = null;

export function setPermissionHandler(fn: PermissionFn): void {
  _permissionFn = fn;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  opts?: { silent?: boolean },
): Promise<ToolResult> {
  const tool = getTool(toolName);

  if (!tool) {
    const result: ToolResult = { success: false, output: '', error: `Unknown tool: ${toolName}` };
    if (!opts?.silent) {
      process.stdout.write(chalk.red(`\n  ✗  ${toolName}`) + chalk.dim('  (unknown tool)\n'));
    }
    return result;
  }

  // ── Permission check ───────────────────────────────────────────────────────
  if (_permissionFn && !opts?.silent) {
    const check = classifyToolCall(toolName, input);
    if (check && !isSessionAllowed(check.category) && !isProjectAllowed(check.category)) {
      const decision = await _permissionFn(check.category, check.label, check.detail);
      if (decision === 'deny') {
        process.stdout.write(chalk.red('  ✗  ') + chalk.red(toolName) + chalk.dim('  permission denied\n'));
        return { success: false, output: '', error: 'Permission denied by user' };
      }
      if (decision === 'always')  grantSession(check.category);
      if (decision === 'project') grantProject(check.category);
    }
  }

  const start = Date.now();

  const argSummary = Object.entries(input)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join('  ');

  let result: ToolResult;
  try {
    result = await tool.execute(input);
  } catch (err) {
    result = { success: false, output: '', error: String(err) };
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2) + 's';

  if (!opts?.silent) {
    if (result.success) {
      process.stdout.write(
        chalk.green('  ✓  ') +
        chalk.cyan(toolName) +
        (argSummary ? chalk.dim('  ' + argSummary) : '') +
        chalk.dim('  ── ' + elapsed) +
        '\n',
      );
    } else {
      const errMsg = result.error ?? 'failed';
      process.stdout.write(
        chalk.red('  ✗  ') +
        chalk.red(toolName) +
        chalk.dim('  ' + errMsg) +
        chalk.dim('  ── ' + elapsed) +
        '\n',
      );
    }
  }

  return result;
}
