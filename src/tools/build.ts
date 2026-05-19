import { exec } from 'child_process';
import { promisify } from 'util';
import type { Tool, ToolResult } from './types.js';

const execAsync = promisify(exec);

async function runBuildCommand(command: string, timeoutMs: number): Promise<ToolResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    const output = [stdout, stderr].filter(Boolean).join('\n').trim();
    return { success: true, output: output || '(no output)' };
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

const runTestsTool: Tool = {
  name: 'run_tests',
  description: 'Run the project test suite',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Test command to run (e.g., "npm test", "pytest", "go test ./...")' },
    },
    required: ['command'],
  },
  async execute(input): Promise<ToolResult> {
    const command = String(input['command']);
    return runBuildCommand(command, 120_000);
  },
};

const buildProjectTool: Tool = {
  name: 'build_project',
  description: 'Build the project',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Build command to run (e.g., "npm run build", "make", "cargo build")' },
    },
    required: ['command'],
  },
  async execute(input): Promise<ToolResult> {
    const command = String(input['command']);
    return runBuildCommand(command, 300_000);
  },
};

const lintCodeTool: Tool = {
  name: 'lint_code',
  description: 'Run linting on the project',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Lint command to run (e.g., "npm run lint", "eslint src", "flake8")' },
    },
    required: ['command'],
  },
  async execute(input): Promise<ToolResult> {
    const command = String(input['command']);
    return runBuildCommand(command, 60_000);
  },
};

export const buildTools: Tool[] = [runTestsTool, buildProjectTool, lintCodeTool];
