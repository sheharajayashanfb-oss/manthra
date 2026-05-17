import { exec } from 'child_process';
import { promisify } from 'util';
import type { Tool, ToolResult } from './types.js';

const execAsync = promisify(exec);

export const bashTool: Tool = {
  name: 'bash',
  description: 'Execute a shell command and return the output. Use for running tests, building code, installing packages, git operations, and other terminal tasks.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
    },
    required: ['command'],
  },
  async execute(input): Promise<ToolResult> {
    const command = input['command'] as string;
    const timeout = (input['timeout'] as number) ?? 30000;

    if (!command) return { success: false, output: '', error: 'No command provided' };

    const BLOCKED = ['rm -rf /', 'mkfs', 'dd if=/dev/zero', ':(){:|:&};:'];
    if (BLOCKED.some((b) => command.includes(b))) {
      return { success: false, output: '', error: 'Command blocked for safety' };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        cwd: process.cwd(),
        shell: '/bin/zsh',
      });
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
