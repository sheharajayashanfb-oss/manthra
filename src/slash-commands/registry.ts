import chalk from 'chalk';
import type { SlashCommand } from './types.js';
import { exitCommand } from './exit.js';
import { initCommand } from './init.js';

const webCommand: SlashCommand = {
  name: 'web',
  aliases: [],
  description: 'Open the web UI to configure providers and models',
  async handler(_args, _ctx) {
    const url = 'http://localhost:4875';
    console.log(chalk.dim(`\n  Opening ${url} …\n`));
    import('open')
      .then(({ default: open }) => open(url))
      .catch(() => console.log(chalk.dim(`  Navigate to ${url} in your browser.\n`)));
  },
};

const commands: SlashCommand[] = [exitCommand, webCommand, initCommand];

const commandMap = new Map<string, SlashCommand>();
for (const cmd of commands) {
  commandMap.set(cmd.name, cmd);
  for (const alias of cmd.aliases ?? []) {
    commandMap.set(alias, cmd);
  }
}

export function getCommand(name: string): SlashCommand | undefined {
  return commandMap.get(name.toLowerCase());
}

export function getAllCommands(): SlashCommand[] {
  return commands;
}
