import chalk from 'chalk';
import type { SlashCommand } from './types.js';
import { addMemory, listMemory, deleteMemory, clearMemory } from '../memory/store.js';

export const rememberCommand: SlashCommand = {
  name: 'remember',
  aliases: [],
  description: 'Save something to persistent memory',
  usage: '/remember <text>',

  async handler(args, _ctx) {
    const text = args.trim();
    if (!text) {
      console.log(chalk.yellow('\n  Usage: /remember <text>\n'));
      return;
    }
    const entry = addMemory(text);
    console.log(chalk.dim(`\n  Saved memory [${entry.id}]: `) + chalk.white(text) + '\n');
  },
};

export const forgetCommand: SlashCommand = {
  name: 'forget',
  aliases: [],
  description: 'Remove a memory entry by ID',
  usage: '/forget <id>',

  async handler(args, _ctx) {
    const id = args.trim();
    if (!id) {
      console.log(chalk.yellow('\n  Usage: /forget <id>\n'));
      return;
    }
    const ok = deleteMemory(id);
    if (ok) {
      console.log(chalk.dim(`\n  Removed memory entry: ${id}\n`));
    } else {
      console.log(chalk.yellow(`\n  No memory entry found with id: ${id}\n`));
    }
  },
};

export const memoryCommand: SlashCommand = {
  name: 'memory',
  aliases: ['mem'],
  description: 'List all saved memory entries',
  usage: '/memory [clear]',

  async handler(args, _ctx) {
    if (args.trim() === 'clear') {
      clearMemory();
      console.log(chalk.dim('\n  All memory entries cleared.\n'));
      return;
    }

    const entries = listMemory();
    if (entries.length === 0) {
      console.log(chalk.dim('\n  No memory entries. Use /remember <text> to save one.\n'));
      return;
    }

    console.log(chalk.dim('\n  Saved memories:\n'));
    for (const e of entries) {
      console.log(`  ${chalk.cyan(e.id)}  ${e.content}`);
    }
    console.log(chalk.dim('\n  Use /forget <id> to remove an entry.\n'));
  },
};
