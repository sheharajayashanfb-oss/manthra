import { exec } from 'child_process';
import { promisify } from 'util';
import type { Tool, ToolResult } from './types.js';

const execAsync = promisify(exec);

async function runInfraCommand(command: string, timeoutMs = 30_000): Promise<ToolResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
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

const dockerExecTool: Tool = {
  name: 'docker_exec',
  description: 'Execute a command inside a running Docker container',
  parameters: {
    type: 'object',
    properties: {
      container: { type: 'string', description: 'Container name or ID' },
      command: { type: 'string', description: 'Command to run inside the container' },
    },
    required: ['container', 'command'],
  },
  async execute(input): Promise<ToolResult> {
    const container = String(input['container']);
    const command = String(input['command']);
    return runInfraCommand(`docker exec ${container} ${command}`);
  },
};

const dockerLogsTool: Tool = {
  name: 'docker_logs',
  description: 'Fetch logs from a Docker container',
  parameters: {
    type: 'object',
    properties: {
      container: { type: 'string', description: 'Container name or ID' },
      lines: { type: 'number', description: 'Number of log lines to retrieve (default: 100)' },
    },
    required: ['container'],
  },
  async execute(input): Promise<ToolResult> {
    const container = String(input['container']);
    const lines = input['lines'] != null ? Number(input['lines']) : 100;
    return runInfraCommand(`docker logs --tail=${lines} ${container}`);
  },
};

const k8sApplyTool: Tool = {
  name: 'k8s_apply',
  description: 'Apply a Kubernetes manifest file',
  parameters: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Path to the Kubernetes manifest YAML file' },
    },
    required: ['file'],
  },
  async execute(input): Promise<ToolResult> {
    const file = String(input['file']);
    return runInfraCommand(`kubectl apply -f "${file}"`);
  },
};

export const infraTools: Tool[] = [dockerExecTool, dockerLogsTool, k8sApplyTool];
