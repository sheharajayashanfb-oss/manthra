import express from 'express';
import cors from 'cors';
import chalk from 'chalk';
import { getConfig, updateConfig } from '../config/loader.js';
import { createProvider } from '../providers/registry.js';
import { ProviderConfigSchema } from '../config/types.js';
import { INLINE_HTML } from './assets.generated.js';

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

  // GET /api/tools
  app.get('/api/tools', async (_req, res) => {
    const { getToolDefinitions } = await import('../tools/registry.js');
    res.json(getToolDefinitions());
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
