import express from 'express';
import cors from 'cors';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getConfig, updateConfig } from '../config/loader.js';
import { createProvider } from '../providers/registry.js';
import { ProviderConfigSchema, McpServerConfigSchema, TeamSchema } from '../config/types.js';
import { getAllTools } from '../tools/registry.js';
import { McpClient } from '../mcp/client.js';
import { INLINE_HTML } from './assets.generated.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VERSION_URL = 'https://manthra.informaticsint.au/version.json';

function getCurrentVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

function isNewer(latest: string, current: string): boolean {
  const pa = latest.replace(/^v/, '').split('.').map(Number);
  const pb = current.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff > 0) return true;
    if (diff < 0) return false;
  }
  return false;
}

export async function startServer(port?: number): Promise<void> {
  const config = getConfig();
  const serverPort = port ?? config.webPort;
  const app = express();

  app.use(cors());
  app.use(express.json());

  // GET /api/providers
  app.get('/api/providers', (_req, res) => {
    const cfg = getConfig();
    // Mask API keys
    const safe = cfg.providers.map((p) => ({ ...p, apiKey: p.apiKey ? '***' + p.apiKey.slice(-4) : undefined }));
    res.json(safe);
  });

  // POST /api/providers — add new provider
  app.post('/api/providers', (req, res) => {
    try {
      const parsed = ProviderConfigSchema.parse({
        id: `${req.body.type}-${Date.now()}`,
        ...req.body,
      });
      const cfg = getConfig();
      if (cfg.providers.some((p) => p.name === parsed.name)) {
        res.status(400).json({ error: 'A provider with this name already exists' });
        return;
      }
      const updated = updateConfig({ providers: [...cfg.providers, parsed] });
      const safe = { ...parsed, apiKey: parsed.apiKey ? '***' + parsed.apiKey.slice(-4) : undefined };
      res.json(safe);
    } catch (err: unknown) {
      res.status(400).json({ error: String(err) });
    }
  });

  // PUT /api/providers/:id — update provider
  app.put('/api/providers/:id', (req, res) => {
    const { id } = req.params;
    const cfg = getConfig();
    const idx = cfg.providers.findIndex((p) => p.id === id);
    if (idx === -1) { res.status(404).json({ error: 'Provider not found' }); return; }

    try {
      const existing = cfg.providers[idx];
      // Don't overwrite masked API key
      const apiKey = req.body.apiKey && !req.body.apiKey.startsWith('***')
        ? req.body.apiKey
        : existing.apiKey;
      const parsed = ProviderConfigSchema.parse({ ...existing, ...req.body, id, apiKey });
      const providers = [...cfg.providers];
      providers[idx] = parsed;
      updateConfig({ providers });
      const safe = { ...parsed, apiKey: parsed.apiKey ? '***' + parsed.apiKey.slice(-4) : undefined };
      res.json(safe);
    } catch (err: unknown) {
      res.status(400).json({ error: String(err) });
    }
  });

  // DELETE /api/providers/:id
  app.delete('/api/providers/:id', (req, res) => {
    const { id } = req.params;
    const cfg = getConfig();
    const providers = cfg.providers.filter((p) => p.id !== id);
    if (providers.length === cfg.providers.length) { res.status(404).json({ error: 'Not found' }); return; }
    updateConfig({ providers });
    res.json({ ok: true });
  });

  // POST /api/providers/test-inline — test a provider config without saving it
  app.post('/api/providers/test-inline', async (req, res) => {
    try {
      const parsed = ProviderConfigSchema.parse({
        id: `inline-test-${Date.now()}`,
        ...req.body,
      });
      const provider = createProvider(parsed);
      const ok = await provider.testConnection();
      res.json({ ok, message: ok ? 'Connection successful' : 'Connection failed' });
    } catch (err: unknown) {
      res.json({ ok: false, message: String(err) });
    }
  });

  // POST /api/providers/list-models-inline — list models for unsaved provider config
  app.post('/api/providers/list-models-inline', async (req, res) => {
    try {
      const parsed = ProviderConfigSchema.parse({
        id: `inline-models-${Date.now()}`,
        ...req.body,
      });
      const provider = createProvider(parsed);
      const models = await provider.listModels();
      res.json(models);
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/providers/:id/test
  app.post('/api/providers/:id/test', async (req, res) => {
    const { id } = req.params;
    const cfg = getConfig();
    const providerConfig = cfg.providers.find((p) => p.id === id);
    if (!providerConfig) { res.status(404).json({ error: 'Provider not found' }); return; }
    try {
      const provider = createProvider(providerConfig);
      const ok = await provider.testConnection();
      res.json({ ok, message: ok ? 'Connection successful' : 'Connection failed' });
    } catch (err: unknown) {
      res.json({ ok: false, message: String(err) });
    }
  });

  // GET /api/providers/:id/models
  app.get('/api/providers/:id/models', async (req, res) => {
    const { id } = req.params;
    const cfg = getConfig();
    const providerConfig = cfg.providers.find((p) => p.id === id);
    if (!providerConfig) { res.status(404).json({ error: 'Provider not found' }); return; }
    try {
      const provider = createProvider(providerConfig);
      const models = await provider.listModels();
      res.json(models);
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/config
  app.get('/api/config', (_req, res) => {
    const cfg = getConfig();
    res.json({
      activeProvider: cfg.activeProvider,
      activeModel: cfg.activeModel,
      maxTokens: cfg.maxTokens,
      temperature: cfg.temperature,
      theme: cfg.theme,
      webPort: cfg.webPort,
      multiAgent: cfg.multiAgent,
    });
  });

  // PATCH /api/config
  app.patch('/api/config', (req, res) => {
    try {
      const updated = updateConfig(req.body);
      res.json({ ok: true, activeProvider: updated.activeProvider, activeModel: updated.activeModel });
    } catch (err: unknown) {
      res.status(400).json({ error: String(err) });
    }
  });

  // GET /api/tools — includes MCP tools fetched live from enabled servers
  app.get('/api/tools', async (_req, res) => {
    const tools = getAllTools().map(t => ({ name: t.name, description: t.description }));

    const cfg = getConfig();
    const mcpServers = (cfg.mcpServers ?? []).filter(s => s.enabled !== false);
    const mcpTools: { name: string; description: string }[] = [];

    await Promise.all(mcpServers.map(async (srv) => {
      const client = new McpClient(srv);
      try {
        await client.connect();
        const serverTools = await client.listTools();
        const prefix = `mcp__${srv.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}__`;
        for (const t of serverTools) {
          mcpTools.push({ name: prefix + t.name, description: t.description });
        }
      } catch { /* skip unreachable servers */ } finally {
        await client.disconnect().catch(() => {});
      }
    }));

    res.json([...tools, ...mcpTools]);
  });

  // ── MCP Servers ──────────────────────────────────────────────────────────────

  // GET /api/mcp
  app.get('/api/mcp', (_req, res) => {
    const cfg = getConfig();
    res.json(cfg.mcpServers ?? []);
  });

  // POST /api/mcp — add new MCP server
  app.post('/api/mcp', (req, res) => {
    try {
      const parsed = McpServerConfigSchema.parse({
        id: `mcp-${Date.now()}`,
        ...req.body,
      });
      const cfg = getConfig();
      if ((cfg.mcpServers ?? []).some((s) => s.name === parsed.name)) {
        res.status(400).json({ error: 'An MCP server with this name already exists' });
        return;
      }
      updateConfig({ mcpServers: [...(cfg.mcpServers ?? []), parsed] });
      res.json(parsed);
    } catch (err: unknown) {
      res.status(400).json({ error: String(err) });
    }
  });

  // PUT /api/mcp/:id — update MCP server
  app.put('/api/mcp/:id', (req, res) => {
    const { id } = req.params;
    const cfg = getConfig();
    const servers = cfg.mcpServers ?? [];
    const idx = servers.findIndex((s) => s.id === id);
    if (idx === -1) { res.status(404).json({ error: 'MCP server not found' }); return; }
    try {
      const parsed = McpServerConfigSchema.parse({ ...servers[idx], ...req.body, id });
      const updated = [...servers];
      updated[idx] = parsed;
      updateConfig({ mcpServers: updated });
      res.json(parsed);
    } catch (err: unknown) {
      res.status(400).json({ error: String(err) });
    }
  });

  // DELETE /api/mcp/:id
  app.delete('/api/mcp/:id', (req, res) => {
    const { id } = req.params;
    const cfg = getConfig();
    const servers = (cfg.mcpServers ?? []).filter((s) => s.id !== id);
    if (servers.length === (cfg.mcpServers ?? []).length) {
      res.status(404).json({ error: 'Not found' }); return;
    }
    updateConfig({ mcpServers: servers });
    res.json({ ok: true });
  });

  // POST /api/mcp/test-inline — test an unsaved MCP server config
  app.post('/api/mcp/test-inline', async (req, res) => {
    try {
      const parsed = McpServerConfigSchema.parse({
        id: `mcp-test-${Date.now()}`,
        ...req.body,
      });
      const client = new McpClient(parsed);
      await client.connect();
      const tools = await client.listTools();
      await client.disconnect();
      res.json({ ok: true, message: `Connected — ${tools.length} tool(s) available`, toolCount: tools.length });
    } catch (err: unknown) {
      res.json({ ok: false, message: String(err) });
    }
  });

  // POST /api/mcp/:id/test — test a saved MCP server config
  app.post('/api/mcp/:id/test', async (req, res) => {
    const { id } = req.params;
    const cfg = getConfig();
    const server = (cfg.mcpServers ?? []).find((s) => s.id === id);
    if (!server) { res.status(404).json({ error: 'MCP server not found' }); return; }
    try {
      const client = new McpClient(server);
      await client.connect();
      const tools = await client.listTools();
      await client.disconnect();
      res.json({ ok: true, message: `Connected — ${tools.length} tool(s) available`, toolCount: tools.length });
    } catch (err: unknown) {
      res.json({ ok: false, message: String(err) });
    }
  });

  // ── Teams ─────────────────────────────────────────────────────────────────────

  // GET /api/teams
  app.get('/api/teams', (_req, res) => {
    const cfg = getConfig();
    res.json({ teams: cfg.teams ?? [], activeTeam: cfg.activeTeam ?? null });
  });

  // POST /api/teams
  app.post('/api/teams', (req, res) => {
    try {
      const parsed = TeamSchema.parse({ id: `team-${Date.now()}`, ...req.body });
      const cfg = getConfig();
      updateConfig({ teams: [...(cfg.teams ?? []), parsed] });
      res.json(parsed);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // PUT /api/teams/:id
  app.put('/api/teams/:id', (req, res) => {
    const { id } = req.params;
    const cfg = getConfig();
    const teams = cfg.teams ?? [];
    const idx = teams.findIndex((t) => t.id === id);
    if (idx === -1) { res.status(404).json({ error: 'Team not found' }); return; }
    try {
      const parsed = TeamSchema.parse({ ...teams[idx], ...req.body, id });
      const updated = [...teams];
      updated[idx] = parsed;
      updateConfig({ teams: updated });
      res.json(parsed);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // DELETE /api/teams/:id
  app.delete('/api/teams/:id', (req, res) => {
    const { id } = req.params;
    const cfg = getConfig();
    const teams = (cfg.teams ?? []).filter((t) => t.id !== id);
    if (teams.length === (cfg.teams ?? []).length) { res.status(404).json({ error: 'Not found' }); return; }
    const update: Record<string, unknown> = { teams };
    if (cfg.activeTeam === id) update.activeTeam = undefined;
    updateConfig(update);
    res.json({ ok: true });
  });

  // PATCH /api/teams/active — set or clear active team
  app.patch('/api/teams/active', (req, res) => {
    const { teamId } = req.body as { teamId: string | null };
    updateConfig({ activeTeam: teamId ?? undefined });
    res.json({ ok: true, activeTeam: teamId ?? null });
  });

  // GET /api/version — current + latest version info
  app.get('/api/version', async (_req, res) => {
    const current = getCurrentVersion();
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      const response = await fetch(VERSION_URL, { signal: controller.signal });
      const data = (await response.json()) as { version: string; date?: string };
      const latest = data.version.replace(/^v/, '');
      res.json({ current, latest, date: data.date ?? null, updateAvailable: isNewer(latest, current) });
    } catch {
      res.json({ current, latest: null, date: null, updateAvailable: false });
    }
  });

  // POST /api/update — re-run the install script to update the binary
  app.post('/api/update', async (_req, res) => {
    const { exec } = await import('child_process');
    const cmd = 'curl -fsSL https://manthra.informaticsint.au/install | bash';
    exec(cmd, { timeout: 120000 }, (err, _stdout, stderr) => {
      if (err) {
        res.json({ ok: false, message: stderr || err.message });
      } else {
        res.json({ ok: true, message: 'Update complete. Please restart Manthra.' });
      }
    });
  });

  // Serve the self-contained web UI (CSS+JS inlined at build time)
  app.get('*', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(INLINE_HTML);
  });

  const server = app.listen(serverPort, () => {
    console.log(chalk.green(`\n  Manthra GUI running at http://localhost:${serverPort}`));
    console.log(chalk.gray('  Press Ctrl+C to stop\n'));
    import('open').then(({ default: open }) => open(`http://localhost:${serverPort}`)).catch(() => {});
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(chalk.yellow(`\n  Port ${serverPort} is already in use.`));
      console.log(chalk.dim(`  Is Manthra GUI already running? Open http://localhost:${serverPort}\n`));
      process.exit(1);
    } else {
      console.error(chalk.red(`\n  Server error: ${err.message}`));
      process.exit(1);
    }
  });
}
