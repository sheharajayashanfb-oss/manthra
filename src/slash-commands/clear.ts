import chalk from 'chalk';
import type { SlashCommand } from './types.js';

export const clearCommand: SlashCommand = {
  name: 'clear',
  aliases: ['reset'],
  description: 'Clear conversation history and start a fresh session',
  usage: '/clear',

  async handler(_args, ctx) {
    ctx.history.clear();
    console.log(chalk.dim('\n  Conversation cleared.\n'));
  },
};
