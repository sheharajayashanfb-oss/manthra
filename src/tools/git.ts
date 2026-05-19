import { exec } from 'child_process';
import { promisify } from 'util';
import type { Tool, ToolResult } from './types.js';

const execAsync = promisify(exec);

async function git(args: string): Promise<ToolResult> {
  try {
    const { stdout, stderr } = await execAsync(`git ${args}`, {
      cwd: process.cwd(),
      maxBuffer: 5 * 1024 * 1024,
    });
    const output = [stdout, stderr].filter(Boolean).join('\n').trim();
    return { success: true, output: output || '(no output)' };
  } catch (err: unknown) {
    if (err instanceof Error) {
      const execErr = err as Error & { stdout?: string; stderr?: string; code?: number };
      const out = [execErr.stdout, execErr.stderr].filter(Boolean).join('\n').trim();
      return { success: false, output: out, error: `git exited with code ${execErr.code ?? '?'}: ${execErr.message}` };
    }
    return { success: false, output: '', error: String(err) };
  }
}

const gitStatusTool: Tool = {
  name: 'git_status',
  description: 'Show the working tree status of the git repository',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(): Promise<ToolResult> {
    return git('status');
  },
};

const gitDiffTool: Tool = {
  name: 'git_diff',
  description: 'Show git diff for the working tree or a specific file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Optional file path to diff' },
    },
    required: [],
  },
  async execute(input): Promise<ToolResult> {
    const path = input['path'] ? String(input['path']) : '';
    return git(path ? `diff ${path}` : 'diff');
  },
};

const gitAddTool: Tool = {
  name: 'git_add',
  description: 'Stage files for commit',
  parameters: {
    type: 'object',
    properties: {
      files: { type: 'string', description: 'File path(s) to stage, or "." for all changes' },
    },
    required: ['files'],
  },
  async execute(input): Promise<ToolResult> {
    const files = input['files'];
    const fileStr = Array.isArray(files)
      ? (files as string[]).map((f) => `"${f}"`).join(' ')
      : `"${String(files)}"`;
    return git(`add ${fileStr}`);
  },
};

const gitCommitTool: Tool = {
  name: 'git_commit',
  description: 'Commit staged changes with a message',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The commit message' },
    },
    required: ['message'],
  },
  async execute(input): Promise<ToolResult> {
    const message = String(input['message']).replace(/"/g, '\\"');
    return git(`commit -m "${message}"`);
  },
};

const gitLogTool: Tool = {
  name: 'git_log',
  description: 'Show recent git commit history',
  parameters: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Number of commits to show (default: 10)' },
    },
    required: [],
  },
  async execute(input): Promise<ToolResult> {
    const limit = input['limit'] != null ? Number(input['limit']) : 10;
    return git(`log --oneline -${limit}`);
  },
};

export const gitTools: Tool[] = [
  gitStatusTool,
  gitDiffTool,
  gitAddTool,
  gitCommitTool,
  gitLogTool,
];
