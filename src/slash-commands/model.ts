import chalk from 'chalk';
import type { SlashCommand } from './types.js';

export const modelCommand: SlashCommand = {
  name: 'model',
  aliases: ['m'],
  description: 'Show or switch the active model',
  usage: '/model [model-name]',

  async handler(args, ctx) {
    const name = args.trim();

    if (!ctx.provider) {
      console.log(chalk.yellow('\n  No provider configured. Run `manthra web` to add one.\n'));
      return;
    }

    if (!name) {
      // Show current model and list available ones
      console.log(chalk.dim(`\n  Current model: `) + chalk.white(ctx.model || '(none)'));
      try {
        const models = await ctx.provider.listModels();
        if (models.length > 0) {
          console.log(chalk.dim('\n  Available models:'));
          for (const m of models) {
            const marker = m.id === ctx.model ? chalk.cyan('▸ ') : '  ';
            console.log(`  ${marker}${m.id}`);
          }
        }
      } catch {
        console.log(chalk.dim('  (Could not list models)'));
      }
      console.log(chalk.dim('\n  Use /model <name> to switch.\n'));
      return;
    }

    // Switch model — store on context (REPL reads ctx.model each turn)
    ctx.model = name;
    console.log(chalk.dim(`\n  Switched to `) + chalk.white(name) + '\n');
  },
};
