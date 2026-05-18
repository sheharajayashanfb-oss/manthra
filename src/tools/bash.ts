import { exec } from 'child_process';
import { promisify } from 'util';
import { resolvedShell, usesPowerShell } from './platform.js';
import type { Tool, ToolResult } from './types.js';

const execAsync = promisify(exec);

const BLOCKED_UNIX = ['rm -rf /', 'mkfs', 'dd if=/dev/zero', ':(){:|:&};:'];
const BLOCKED_WIN  = [
  'format-volume', 'format c', 'format d',
  'rd /s /q c:\\', 'del /f /s /q c:\\',
  'remove-item -recurse -force c:\\', 'remove-item -recurse -force /',
];

function isBlocked(command: string): boolean {
  const lower = command.toLowerCase();
  return (usesPowerShell ? BLOCKED_WIN : BLOCKED_UNIX).some((b) => lower.includes(b));
}

async function runCommand(command: string, timeout: number) {
  const opts = { timeout, maxBuffer: 10 * 1024 * 1024, cwd: process.cwd() };

  if (usesPowerShell) {
    // Encode as base64 UTF-16LE to pass to PowerShell -EncodedCommand.
    // This avoids all shell-escaping issues regardless of what the command contains.
    const encoded = Buffer.from(command, 'utf16le').toString('base64');
    return execAsync(
      `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      opts,
    );
  }

  return execAsync(command, { ...opts, shell: resolvedShell! });
}

export const bashTool: Tool = {
  name: 'bash',
  description: usesPowerShell
    ? 'Execute a PowerShell command and return its output. Use PowerShell cmdlets: Get-ChildItem, Select-String, Copy-Item, Move-Item, Remove-Item, Get-Content, Set-Content, New-Item. Standard dev tools (git, npm, node, python) work normally.'
    : 'Execute a shell command and return the output. Use for running tests, building code, installing packages, git operations, and other terminal tasks.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The command to execute' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
    },
    required: ['command'],
  },
  async execute(input): Promise<ToolResult> {
    const command = input['command'] as string;
    const timeout = (input['timeout'] as number) ?? 30000;

    if (!command) return { success: false, output: '', error: 'No command provided' };
    if (isBlocked(command)) return { success: false, output: '', error: 'Command blocked for safety' };

    try {
      const { stdout, stderr } = await runCommand(command, timeout);
      const output = [stdout, stderr].filter(Boolean).join('\n').trim();
      return { success: true, output: output || '(no output)' };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string; killed?: boolean };
      if (e.killed) return { success: false, output: e.stdout ?? '', error: `Command timed out after ${timeout}ms` };
      const output = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
      return { success: false, output, error: e.message ?? 'Command failed' };
    }
  },
};
