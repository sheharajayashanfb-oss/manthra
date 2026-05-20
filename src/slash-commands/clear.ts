import chalk from 'chalk';
import type { SlashCommand } from './types.js';

export const clearCommand: SlashCommand = {
  name: 'clear',
  aliases: ['reset'],
  description: 'Clear conversation history and start a fresh session',
  usage: '/clear',

  async handler(_args, ctx) {
    const { total, estimatedTokens } = ctx.history.stats();
    ctx.history.clear();

    if (total === 0) {
      process.stdout.write(chalk.dim('\n  Context is already empty.\n\n'));
      return;
    }

    const tok = estimatedTokens >= 1000
      ? (estimatedTokens / 1000).toFixed(1) + 'k'
      : String(estimatedTokens);

    process.stdout.write(
      chalk.dim(`\n  ✦  Cleared ${total} message${total !== 1 ? 's' : ''} (~${tok} tokens). Fresh context ready.\n\n`)
    );
  },
};
