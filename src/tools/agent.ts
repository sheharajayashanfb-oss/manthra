import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import type { Tool, ToolResult } from './types.js';

function getManthraDir(): string {
  const dir = join(homedir(), '.manthra');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function generateId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

const thinkTool: Tool = {
  name: 'think',
  description: 'Log reasoning or notes to yourself before taking action. Useful for planning complex tasks.',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'Your reasoning or notes' },
    },
    required: ['content'],
  },
  async execute(input): Promise<ToolResult> {
    const content = String(input['content']);
    process.stdout.write(chalk.dim(`\n  [thinking] ${content}\n`));
    return { success: true, output: `Noted: ${content.slice(0, 100)}` };
  },
};

const memorySaveTool: Tool = {
  name: 'memory_save',
  description: 'Save a key-value pair to persistent memory',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'The key to store the value under' },
      value: { type: 'string', description: 'The value to store' },
    },
    required: ['key', 'value'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const key = String(input['key']);
      const value = String(input['value']);
      const filePath = join(getManthraDir(), 'kv-memory.json');
      const memory = readJson<Record<string, string>>(filePath, {});
      memory[key] = value;
      writeJson(filePath, memory);
      return { success: true, output: `Saved memory: ${key}` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

const memoryGetTool: Tool = {
  name: 'memory_get',
  description: 'Retrieve a value from persistent memory by key',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'The key to retrieve' },
    },
    required: ['key'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const key = String(input['key']);
      const filePath = join(getManthraDir(), 'kv-memory.json');
      const memory = readJson<Record<string, string>>(filePath, {});
      if (!(key in memory)) {
        return { success: true, output: `No memory found for key: ${key}` };
      }
      return { success: true, output: String(memory[key]) };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const taskCreateTool: Tool = {
  name: 'task_create',
  description: 'Create a new task to track work',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short task title' },
      description: { type: 'string', description: 'Detailed task description' },
    },
    required: ['title', 'description'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const title = String(input['title']);
      const description = String(input['description']);
      const filePath = join(getManthraDir(), 'tasks.json');
      const tasks = readJson<Task[]>(filePath, []);
      const task: Task = {
        id: generateId(),
        title,
        description,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      tasks.push(task);
      writeJson(filePath, tasks);
      return { success: true, output: `Task created: ${task.id} — ${title}` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

const taskUpdateTool: Tool = {
  name: 'task_update',
  description: 'Update the status of an existing task',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Task ID to update' },
      status: { type: 'string', description: 'New status (e.g., pending, in_progress, done, blocked)' },
    },
    required: ['id', 'status'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const id = String(input['id']);
      const status = String(input['status']);
      const filePath = join(getManthraDir(), 'tasks.json');
      const tasks = readJson<Task[]>(filePath, []);
      const task = tasks.find((t) => t.id === id);
      if (!task) {
        return { success: false, output: '', error: `Task not found: ${id}` };
      }
      task.status = status;
      task.updatedAt = new Date().toISOString();
      writeJson(filePath, tasks);
      return { success: true, output: `Task ${id} updated to: ${status}` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

export const agentTools: Tool[] = [
  thinkTool,
  memorySaveTool,
  memoryGetTool,
  taskCreateTool,
  taskUpdateTool,
];
