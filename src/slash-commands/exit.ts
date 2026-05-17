import chalk from 'chalk';
import type { SlashCommand } from './types.js';

export const exitCommand: SlashCommand = {
  name: 'exit',
  aliases: ['quit', 'q'],
  description: 'Exit Manthra',
  async handler(_, ctx) {
    if (ctx.history.length() > 0) ctx.history.save();
    console.log(chalk.gray('\n  Goodbye!\n'));
    process.exit(0);
  },
};
