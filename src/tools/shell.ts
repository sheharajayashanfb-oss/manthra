import { exec } from 'child_process';
import { promisify } from 'util';
import { isWindows, usesPowerShell, resolvedShell } from './platform.js';
import type { Tool, ToolResult } from './types.js';

const execAsync = promisify(exec);

async function runCommand(command: string, timeoutMs: number): Promise<ToolResult> {
  try {
    let shellOpts: { shell?: string };
    if (isWindows) {
      if (usesPowerShell) {
        shellOpts = { shell: 'powershell.exe' };
      } else if (resolvedShell) {
        shellOpts = { shell: resolvedShell };
      } else {
        shellOpts = {};
      }
    } else {
      shellOpts = { shell: resolvedShell ?? '/bin/sh' };
    }

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
      ...shellOpts,
    });

    const combined = [stdout, stderr].filter(Boolean).join('\n').trim();
    return { success: true, output: combined || '(no output)' };
  } catch (err: unknown) {
    if (err instanceof Error) {
      const execErr = err as Error & { stdout?: string; stderr?: string; killed?: boolean; code?: number };
      if (execErr.killed) {
        return { success: false, output: execErr.stdout ?? '', error: `Command timed out after ${timeoutMs / 1000}s` };
      }
      const out = [execErr.stdout, execErr.stderr].filter(Boolean).join('\n').trim();
      return { success: false, output: out, error: `Exit code ${execErr.code ?? '?'}: ${execErr.message}` };
    }
    return { success: false, output: '', error: String(err) };
  }
}

const bashTool: Tool = {
  name: 'bash',
  description: 'Execute a shell command and return stdout and stderr',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
    },
    required: ['command'],
  },
  async execute(input): Promise<ToolResult> {
    const command = String(input['command']);
    const timeoutSec = input['timeout'] != null ? Number(input['timeout']) : 30;
    return runCommand(command, timeoutSec * 1000);
  },
};

const runScriptTool: Tool = {
  name: 'run_script',
  description: 'Execute a shell command with an explicit timeout parameter',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The command to execute' },
      timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
    },
    required: ['command'],
  },
  async execute(input): Promise<ToolResult> {
    const command = String(input['command']);
    const timeoutSec = input['timeout'] != null ? Number(input['timeout']) : 30;
    return runCommand(command, timeoutSec * 1000);
  },
};

export { runCommand };
export const shellTools: Tool[] = [bashTool, runScriptTool];
