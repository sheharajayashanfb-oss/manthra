import chalk from 'chalk';
import { getTool } from './registry.js';
import type { ToolResult } from './types.js';

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

  const start = Date.now();

  // Format input args for display
  const argSummary = Object.entries(input)
    .slice(0, 3)
    .map(([k, v]) => {
      const val = String(v);
      const truncated = val.length > 60 ? val.slice(0, 57) + '…' : val;
      return `${k}=${truncated}`;
    })
    .join(', ');

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
        chalk.dim('  ' + errMsg.slice(0, 80)) +
        chalk.dim('  ── ' + elapsed) +
        '\n',
      );
    }
  }

  return result;
}
