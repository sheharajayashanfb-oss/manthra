import { exec } from 'child_process';
import { promisify } from 'util';
import type { Tool, ToolResult } from './types.js';

const execAsync = promisify(exec);

function getConnectionString(provided?: string): string | null {
  return provided ?? process.env['DB_CONNECTION_STRING'] ?? null;
}

async function runDbCommand(command: string, timeoutMs = 30_000): Promise<ToolResult> {
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
      const execErr = err as Error & { stdout?: string; stderr?: string; code?: number };
      const out = [execErr.stdout, execErr.stderr].filter(Boolean).join('\n').trim();
      return { success: false, output: out, error: `Exit code ${execErr.code ?? '?'}: ${execErr.message}` };
    }
    return { success: false, output: '', error: String(err) };
  }
}

const dbQueryTool: Tool = {
  name: 'db_query',
  description: 'Execute a SQL query against a database. Supports SQLite by default, or uses DB_CONNECTION_STRING env var.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'SQL query to execute' },
      connection: { type: 'string', description: 'Database connection string or SQLite file path (optional, overrides DB_CONNECTION_STRING env)' },
    },
    required: ['query'],
  },
  async execute(input): Promise<ToolResult> {
    const query = String(input['query']);
    const connection = getConnectionString(input['connection'] ? String(input['connection']) : undefined);

    if (!connection) {
      return {
        success: false,
        output: '',
        error: 'No database connection configured. Set the DB_CONNECTION_STRING environment variable or pass a connection string. For SQLite, pass the .db file path as the connection parameter.',
      };
    }

    // Detect SQLite: connection is a file path ending in .db, .sqlite, .sqlite3
    if (/\.(db|sqlite|sqlite3)$/i.test(connection)) {
      const safeQuery = query.replace(/"/g, '\\"');
      return runDbCommand(`sqlite3 "${connection}" "${safeQuery}"`);
    }

    // For other databases, provide guidance
    return {
      success: false,
      output: '',
      error: `Connection string detected but only SQLite is supported natively. For PostgreSQL/MySQL, use the bash tool with psql/mysql CLI: e.g., bash({ command: "psql '${connection}' -c '${query}'" })`,
    };
  },
};

const dbSchemaTool: Tool = {
  name: 'db_schema',
  description: 'Get the schema of a database table. Supports SQLite by default, or uses DB_CONNECTION_STRING env var.',
  parameters: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name to inspect (leave empty to list all tables)' },
      connection: { type: 'string', description: 'Database connection string or SQLite file path (optional)' },
    },
    required: ['table'],
  },
  async execute(input): Promise<ToolResult> {
    const table = String(input['table']);
    const connection = getConnectionString(input['connection'] ? String(input['connection']) : undefined);

    if (!connection) {
      return {
        success: false,
        output: '',
        error: 'No database connection configured. Set DB_CONNECTION_STRING or pass a connection string.',
      };
    }

    if (/\.(db|sqlite|sqlite3)$/i.test(connection)) {
      const query = table ? `.schema ${table}` : '.tables';
      return runDbCommand(`sqlite3 "${connection}" "${query}"`);
    }

    return {
      success: false,
      output: '',
      error: `Only SQLite is supported natively for schema inspection. For PostgreSQL: \\d ${table}, for MySQL: DESCRIBE ${table}`,
    };
  },
};

export const dbTools: Tool[] = [dbQueryTool, dbSchemaTool];
