import chalk from 'chalk';
import type { SlashCommand } from './types.js';
import { getConfig } from '../config/loader.js';
import { loadProviders, getProvider } from '../providers/registry.js';

export const doctorCommand: SlashCommand = {
  name: 'doctor',
  aliases: ['ping', 'status'],
  description: 'Test connectivity to all configured Ollama providers',
  usage: '/doctor',

  async handler(_args, _ctx) {
    const config = getConfig();
    loadProviders(config.providers);

    const providers = config.providers.filter((p) => p.enabled);

    if (providers.length === 0) {
      console.log(chalk.yellow('\n  No providers configured. Run `manthra web` to add one.\n'));
      return;
    }

    console.log(chalk.dim('\n  Testing providers…\n'));

    for (const cfg of providers) {
      const provider = getProvider(cfg.id);
      if (!provider) continue;

      const label = `  ${cfg.name.padEnd(24)}`;
      process.stdout.write(chalk.dim(`${label} testing…`));

      try {
        const start = Date.now();
        const models = await provider.listModels();
        const ms = Date.now() - start;
        process.stdout.write('\r\x1B[2K');
        console.log(
          `${label} ` +
          chalk.green('✓ reachable') +
          chalk.dim(` · ${models.length} models · ${ms}ms`),
        );
      } catch (err: unknown) {
        process.stdout.write('\r\x1B[2K');
        const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
        console.log(`${label} ` + chalk.red('✗ ' + msg));
      }
    }

    // Active model check
    if (config.activeModel) {
      console.log(chalk.dim(`\n  Active model: ${config.activeModel}`));
    }

    console.log();
  },
};
