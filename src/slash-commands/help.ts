import chalk from 'chalk';
import type { SlashCommand } from './types.js';

export const helpCommand: SlashCommand = {
  name: 'help',
  aliases: ['?'],
  description: 'Show available slash commands',
  usage: '/help',

  async handler(_args, _ctx) {
    console.log(chalk.bold('\n  Slash commands\n'));

    const cmds = [
      { name: '/help',            desc: 'Show this help message' },
      { name: '/clear',           desc: 'Clear conversation history and start fresh' },
      { name: '/model [name]',    desc: 'Show current model, or switch to a different one' },
      { name: '/doctor',          desc: 'Test connectivity to all configured providers' },
      { name: '/remember <text>', desc: 'Save something to persistent memory' },
      { name: '/forget <id>',     desc: 'Remove a memory entry by ID' },
      { name: '/memory',          desc: 'List all saved memory entries' },
      { name: '/init [--force]',  desc: 'Generate a MANTHRA.md project instructions file' },
      { name: '/web',             desc: 'Open the web UI to configure providers' },
      { name: '/exit',            desc: 'Exit Manthra' },
    ];

    for (const { name, desc } of cmds) {
      console.log(`  ${chalk.cyan(name.padEnd(22))}${chalk.dim(desc)}`);
    }

    console.log(chalk.dim('\n  MANTHRA.md is loaded automatically from your project directory.'));
    console.log(chalk.dim('  Use /init to generate one, or edit it directly.\n'));
  },
};
