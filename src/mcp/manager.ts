import { McpClient } from './client.js';
import { getConfig } from '../config/loader.js';
import type { McpServerConfig } from '../config/types.js';
import type { Tool } from '../tools/types.js';

const PREFIX = 'mcp__';

function sanitizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function mcpToolName(serverName: string, toolName: string): string {
  return `${PREFIX}${sanitizeName(serverName)}__${toolName}`;
}

export function isMcpTool(name: string): boolean {
  return name.startsWith(PREFIX);
}

class McpManager {
  private clients = new Map<string, McpClient>();
  private tools = new Map<string, Tool>();
  private serverNames = new Map<string, string>(); // id → name

  async initAll(): Promise<Array<{ name: string; ok: boolean; toolCount: number; error?: string }>> {
    const config = getConfig();
    const servers = (config.mcpServers ?? []).filter((s) => s.enabled);

    const settled = await Promise.allSettled(
      servers.map((server) =>
        this.connectServer(server).then((r) => ({ name: server.name, ...r })),
      ),
    );

    return settled.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { name: '?', ok: false, toolCount: 0, error: String(r.reason) },
    );
  }

  async connectServer(server: McpServerConfig): Promise<{ ok: boolean; toolCount: number; error?: string }> {
    try {
      const client = new McpClient(server);
      await client.connect();
      this.clients.set(server.id, client);
      this.serverNames.set(server.id, server.name);

      const serverTools = await client.listTools();
      for (const tool of serverTools) {
        const prefixed = mcpToolName(server.name, tool.name);
        this.tools.set(prefixed, { ...tool, name: prefixed });
      }
      return { ok: true, toolCount: serverTools.length };
    } catch (err) {
      return { ok: false, toolCount: 0, error: String(err) };
    }
  }

  async disconnectServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) return;
    const name = this.serverNames.get(serverId) ?? '';
    await client.disconnect().catch(() => {});
    this.clients.delete(serverId);
    this.serverNames.delete(serverId);
    // Remove all tools from this server
    for (const [toolName] of this.tools) {
      if (toolName.startsWith(`${PREFIX}${sanitizeName(name)}__`)) {
        this.tools.delete(toolName);
      }
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [, client] of this.clients) {
      await client.disconnect().catch(() => {});
    }
    this.clients.clear();
    this.tools.clear();
    this.serverNames.clear();
  }

  getMcpTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }
}

export const mcpManager = new McpManager();
