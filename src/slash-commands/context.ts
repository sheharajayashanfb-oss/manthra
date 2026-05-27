import chalk from 'chalk';
import type { SlashCommand } from './types.js';

function fmtTokens(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

function progressBar(used: number, total: number, width = 28): string {
  const pct = Math.min(1, used / total);
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const color = pct > 0.85 ? chalk.red : pct > 0.6 ? chalk.yellow : chalk.cyan;
  return color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}

export const contextCommand: SlashCommand = {
  name: 'context',
  aliases: ['ctx'],
  description: 'Show current context usage — message count, estimated tokens, and context window',
  usage: '/context',

  async handler(_args, ctx) {
    const { total, byRole, estimatedTokens } = ctx.history.stats();
    const cw = ctx.contextWindow;

    const cols = Math.min(process.stdout.columns ?? 80, 100);
    const inner = cols - 4; // 2 spaces indent + 2 padding

    const line = (text: string) =>
      process.stdout.write(chalk.dim('  │  ') + text + '\n');

    const sep = () =>
      process.stdout.write(chalk.dim('  ' + '─'.repeat(cols - 2)) + '\n');

    process.stdout.write('\n');
    process.stdout.write(chalk.dim('  ╭─ context ') + chalk.dim('─'.repeat(Math.max(0, cols - 13))) + '\n');

    // ── Message count ─────────────────────────────────────────────────────────
    if (total === 0) {
      line(chalk.dim('No messages in context.'));
    } else {
      const roleParts = Object.entries(byRole)
        .map(([role, count]) => chalk.dim(`${count} ${role}`))
        .join(chalk.dim('  ·  '));
      line(
        chalk.white(`${total} message${total !== 1 ? 's' : ''}`) +
        chalk.dim('  ·  ') + roleParts
      );
    }

    // ── Token usage ───────────────────────────────────────────────────────────
    if (total > 0) {
      if (cw) {
        const pct = Math.min(100, Math.round((estimatedTokens / cw) * 100));
        const pctColor = pct > 85 ? chalk.red : pct > 60 ? chalk.yellow : chalk.cyan;
        line(
          chalk.white(`~${fmtTokens(estimatedTokens)}`) +
          chalk.dim(' of ') +
          chalk.white(fmtTokens(cw)) +
          chalk.dim(' context window  ') +
          pctColor(`${pct}%`)
        );
        line(progressBar(estimatedTokens, cw));
      } else {
        line(chalk.white(`~${fmtTokens(estimatedTokens)} tokens`) + chalk.dim(' estimated (context window unknown)'));
      }
    }

    // ── Hints ─────────────────────────────────────────────────────────────────
    if (total > 0) {
      sep();
      line(chalk.dim('/compact') + chalk.dim(' to summarise  ·  ') + chalk.dim('/clear') + chalk.dim(' to reset'));
    }

    process.stdout.write(chalk.dim('  ╰' + '─'.repeat(cols - 3)) + '\n\n');

    void inner; // suppress unused warning
  },
};
