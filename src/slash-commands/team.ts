import chalk from 'chalk';
import type { SlashCommand } from './types.js';
import { getConfig, updateConfig } from '../config/loader.js';

export const teamCommand: SlashCommand = {
  name: 'team',
  aliases: [],
  description: 'Show or switch the active team',
  usage: '/team [team-name | none]',

  async handler(args, _ctx) {
    const cfg = getConfig();
    const teams = cfg.teams ?? [];
    const nameArg = args.trim();

    if (!nameArg) {
      const active = teams.find((t) => t.id === cfg.activeTeam);
      console.log(chalk.dim('\n  Active team: ') + (active ? chalk.white(active.name) : chalk.dim('none')));
      if (teams.length > 0) {
        console.log(chalk.dim('\n  Available teams:'));
        for (const t of teams) {
          const marker = t.id === cfg.activeTeam ? chalk.cyan('▸ ') : '  ';
          const info = chalk.dim(`  ${t.members.length} member${t.members.length !== 1 ? 's' : ''}`);
          console.log(`  ${marker}${chalk.white(t.name)}${info}`);
        }
      } else {
        console.log(chalk.dim('  No teams configured. Run `manthra web` to create one.'));
      }
      console.log(chalk.dim('\n  Use /team <name> or /team none to switch.\n'));
      return;
    }

    if (nameArg.toLowerCase() === 'none' || nameArg.toLowerCase() === 'off') {
      updateConfig({ activeTeam: undefined });
      console.log(chalk.dim('\n  Team cleared. Restart Manthra to apply.\n'));
      return;
    }

    const team =
      teams.find((t) => t.name.toLowerCase() === nameArg.toLowerCase()) ??
      teams.find((t) => t.id === nameArg);

    if (!team) {
      console.log(chalk.yellow(`\n  Team not found: ${nameArg}`));
      console.log(chalk.dim('  Use /team to see available teams.\n'));
      return;
    }

    updateConfig({ activeTeam: team.id });
    console.log(
      chalk.dim('\n  Active team set to ') +
      chalk.white(team.name) +
      chalk.dim('. Restart Manthra to apply.\n'),
    );
  },
};
