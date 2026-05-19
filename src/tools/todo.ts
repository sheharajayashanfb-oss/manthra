import type { Tool, ToolResult } from './types.js';

export type TodoStatus = 'pending' | 'in_progress' | 'completed';
export type TodoPriority = 'low' | 'medium' | 'high';

export interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
  priority: TodoPriority;
}

// Session-scoped store — resets on process restart, just like Claude Code
const todoStore: TodoItem[] = [];

let nextId = 1;

function formatTodos(todos: TodoItem[]): string {
  if (todos.length === 0) return '(no todos)';

  const byStatus = (s: TodoStatus) => todos.filter((t) => t.status === s);
  const lines: string[] = [];

  const statusLabel: Record<TodoStatus, string> = {
    in_progress: '▶ In progress',
    pending: '○ Pending',
    completed: '✓ Completed',
  };

  for (const status of ['in_progress', 'pending', 'completed'] as TodoStatus[]) {
    const group = byStatus(status);
    if (group.length === 0) continue;
    lines.push(`\n${statusLabel[status]}:`);
    for (const t of group) {
      const prio = t.priority !== 'medium' ? ` [${t.priority}]` : '';
      lines.push(`  [${t.id}] ${t.content}${prio}`);
    }
  }

  return lines.join('\n').trim();
}

export const todoReadTool: Tool = {
  name: 'todo_read',
  description: 'Read the current session todo list. Use this to check what tasks are pending, in progress, or completed.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(_input): Promise<ToolResult> {
    return { success: true, output: formatTodos(todoStore) };
  },
};

export const todoWriteTool: Tool = {
  name: 'todo_write',
  description: 'Create or update the session todo list. Pass the complete list of todos — this replaces the current list. Each todo needs: content (string), status ("pending"|"in_progress"|"completed"), priority ("low"|"medium"|"high"). Only one todo should be "in_progress" at a time.',
  input_schema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'Complete list of todo items (replaces existing list)',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique ID (optional — auto-assigned if omitted)' },
            content: { type: 'string', description: 'Task description' },
            status: { type: 'string', description: '"pending" | "in_progress" | "completed"' },
            priority: { type: 'string', description: '"low" | "medium" | "high"' },
          },
          required: ['content', 'status'],
        },
      },
    },
    required: ['todos'],
  },
  async execute(input): Promise<ToolResult> {
    if (!Array.isArray(input['todos'])) {
      return { success: false, output: '', error: 'todos must be an array' };
    }

    const raw = input['todos'] as Array<Record<string, unknown>>;
    const validStatuses = new Set<string>(['pending', 'in_progress', 'completed']);
    const validPriorities = new Set<string>(['low', 'medium', 'high']);

    todoStore.length = 0;

    for (let i = 0; i < raw.length; i++) {
      const t = raw[i];
      if (typeof t['content'] !== 'string' || !t['content']) {
        return { success: false, output: '', error: `todos[${i}].content must be a non-empty string` };
      }
      const status = (t['status'] as string) ?? 'pending';
      if (!validStatuses.has(status)) {
        return { success: false, output: '', error: `todos[${i}].status must be "pending", "in_progress", or "completed"` };
      }
      const priority = (t['priority'] as string) ?? 'medium';
      if (!validPriorities.has(priority)) {
        return { success: false, output: '', error: `todos[${i}].priority must be "low", "medium", or "high"` };
      }
      const id = (typeof t['id'] === 'string' && t['id']) ? t['id'] : String(nextId++);
      todoStore.push({ id, content: t['content'] as string, status: status as TodoStatus, priority: priority as TodoPriority });
    }

    return { success: true, output: `Todo list updated (${todoStore.length} items):\n\n${formatTodos(todoStore)}` };
  },
};
