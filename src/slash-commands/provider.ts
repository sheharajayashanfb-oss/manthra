import chalk from 'chalk';
import type { SlashCommand } from './types.js';
import { getConfig, updateConfig } from '../config/loader.js';
import { createProvider } from '../providers/registry.js';

export const providerCommand: SlashCommand = {
  name: 'provider',
  aliases: ['prov'],
  description: 'Show or switch the active provider',
  usage: '/provider [provider-name]',

  async handler(args, ctx) {
    const cfg = getConfig();
    const providers = cfg.providers.filter((p) => p.enabled);
    const nameArg = args.trim();

    if (!nameArg) {
      const active = providers.find((p) => p.id === cfg.activeProvider);
      console.log(chalk.dim('\n  Active provider: ') + (active ? chalk.white(active.name) : chalk.dim('none')));
      if (providers.length > 0) {
        console.log(chalk.dim('\n  Available providers:'));
        for (const p of providers) {
          const marker = p.id === cfg.activeProvider ? chalk.cyan('▸ ') : '  ';
          const model = p.defaultModel ? chalk.dim(`  · ${p.defaultModel}`) : '';
          console.log(`  ${marker}${chalk.white(p.name)}${model}`);
        }
      } else {
        console.log(chalk.dim('  No providers configured. Run `manthra web` to add one.'));
      }
      console.log(chalk.dim('\n  Use /provider <name> to switch.\n'));
      return;
    }

    const providerCfg =
      providers.find((p) => p.name.toLowerCase() === nameArg.toLowerCase()) ??
      providers.find((p) => p.id === nameArg);

    if (!providerCfg) {
      console.log(chalk.yellow(`\n  Provider not found: ${nameArg}`));
      console.log(chalk.dim('  Use /provider to see available providers.\n'));
      return;
    }

    const newProvider = createProvider(providerCfg);
    ctx.provider = newProvider;
    ctx.model = providerCfg.defaultModel ?? '';
    updateConfig({ activeProvider: providerCfg.id, activeModel: providerCfg.defaultModel });
    console.log(
      chalk.dim('\n  Switched to ') + chalk.white(providerCfg.name) +
      (providerCfg.defaultModel ? chalk.dim(`  · ${providerCfg.defaultModel}`) : '') + '\n',
    );
  },
};
