import chalk from 'chalk';
import { getTool } from './registry.js';
import type { ToolResult } from './types.js';
import { classifyToolCall, isSessionAllowed, grantSession } from '../permissions/index.js';
import type { PermissionDecision } from '../permissions/index.js';
import { isProjectAllowed, grantProject } from '../permissions/project.js';

function friendlyLabel(toolName: string): string {
  if (toolName === 'read')                          return 'Reading file';
  if (toolName === 'write')                         return 'Writing file';
  if (toolName === 'edit')                          return 'Editing file';
  if (toolName === 'list_dir')                      return 'Listing directory';
  if (toolName === 'glob')                          return 'Searching files';
  if (toolName === 'grep')                          return 'Searching content';
  if (toolName === 'bash' || toolName === 'run_script') return 'Running command';
  if (toolName === 'web_fetch')                     return 'Fetching URL';
  if (toolName === 'http_request')                  return 'HTTP request';
  if (toolName === 'search_web')                    return 'Searching web';
  if (toolName === 'search_files')                  return 'Searching files';
  if (toolName === 'agent_spawn')                   return 'Delegating task';
  if (toolName === 'think')                         return 'Thinking';
  if (toolName === 'memory_save')                   return 'Saving memory';
  if (toolName === 'memory_get')                    return 'Reading memory';
  if (toolName === 'task_create')                   return 'Creating task';
  if (toolName === 'task_update')                   return 'Updating task';
  if (toolName.startsWith('git_'))                  return 'Git operation';
  if (toolName.startsWith('build_'))                return 'Build operation';
  if (toolName.startsWith('db_'))                   return 'Database query';
  if (toolName.startsWith('infra_'))                return 'Infrastructure';
  if (toolName.startsWith('safety_'))               return 'Code analysis';
  if (toolName.startsWith('embed_'))                return 'Embedding';
  if (toolName.startsWith('mcp__'))                 return 'Using tool';
  return 'Working';
}

// Set by REPL to handle interactive permission prompts
type PermissionFn = (category: string, label: string, detail: string) => Promise<PermissionDecision>;
let _permissionFn: PermissionFn | null = null;
let _verbose = false;

export function setPermissionHandler(fn: PermissionFn): void {
  _permissionFn = fn;
}

export function setVerbose(flag: boolean): void {
  _verbose = flag;
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
      process.stdout.write(chalk.red(`\n  ✗  ${_verbose ? toolName : 'Working'}`) + chalk.dim('  (unknown tool)\n'));
    }
    return result;
  }

  // ── Permission check ───────────────────────────────────────────────────────
  if (_permissionFn && !opts?.silent) {
    const check = classifyToolCall(toolName, input);
    if (check && !isSessionAllowed(check.category) && !isProjectAllowed(check.category)) {
      const decision = await _permissionFn(check.category, check.label, check.detail);
      if (decision === 'deny') {
        process.stdout.write(chalk.red('  ✗  ') + chalk.red(_verbose ? toolName : friendlyLabel(toolName)) + chalk.dim('  permission denied\n'));
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
    const label = _verbose ? toolName : friendlyLabel(toolName);
    if (result.success) {
      process.stdout.write(
        chalk.green('  ✓  ') +
        chalk.cyan(label) +
        (argSummary ? chalk.dim('  ' + argSummary) : '') +
        chalk.dim('  ── ' + elapsed) +
        '\n',
      );
    } else {
      const errMsg = result.error ?? 'failed';
      process.stdout.write(
        chalk.red('  ✗  ') +
        chalk.red(label) +
        chalk.dim('  ' + errMsg) +
        chalk.dim('  ── ' + elapsed) +
        '\n',
      );
    }
  }

  return result;
}
