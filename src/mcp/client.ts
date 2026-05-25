import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { McpServerConfig } from '../config/types.js';
import type { Tool, ToolResult } from '../tools/types.js';

export class McpClient {
  private client: Client;
  private config: McpServerConfig;
  private _connected = false;

  constructor(config: McpServerConfig) {
    this.config = config;
    this.client = new Client({ name: 'manthra', version: '1.0.0' }, {});
  }

  async connect(): Promise<void> {
    let transport;
    if (this.config.transport === 'stdio') {
      if (!this.config.command) throw new Error('stdio transport requires a command');
      transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args ?? [],
        env: { ...process.env as Record<string, string>, ...(this.config.env ?? {}) },
        stderr: 'pipe',
      });
    } else {
      if (!this.config.url) throw new Error('http transport requires a url');
      transport = new SSEClientTransport(new URL(this.config.url));
    }

    await this.client.connect(transport, { timeout: 20000 });
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    if (this._connected) {
      await this.client.close().catch(() => {});
      this._connected = false;
    }
  }

  get connected(): boolean {
    return this._connected;
  }

  async listTools(): Promise<Tool[]> {
    const response = await this.client.listTools();
    return response.tools.map((t) => {
      const mcpTool = t;
      return {
        name: mcpTool.name,
        description: mcpTool.description ?? '',
        parameters: (mcpTool.inputSchema ?? { type: 'object', properties: {} }) as Tool['parameters'],
        execute: (input: Record<string, unknown>) => this.callTool(mcpTool.name, input),
      };
    });
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const result = await this.client.callTool({ name, arguments: args });
      const text = (result.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('\n');
      return {
        success: !result.isError,
        output: text,
        error: result.isError ? text : undefined,
      };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  }
}
