import chalk from 'chalk';
import type { ModelInfo, ModelPlan } from '../providers/types.js';

export function formatPlanBadge(plan?: ModelPlan): string {
  if (!plan) return '';
  switch (plan) {
    case 'free':    return chalk.bgGreen.black(' free ');
    case 'preview': return chalk.bgYellow.black(' preview ');
    case 'paid':    return chalk.dim('paid');
  }
}

export function printModelList(models: ModelInfo[], activeModel?: string): void {
  const freeModels = models.filter((m) => m.plan === 'free');
  const otherModels = models.filter((m) => m.plan !== 'free');

  const renderGroup = (group: ModelInfo[]) => {
    for (const m of group) {
      const isActive = m.id === activeModel;
      const idCol = (isActive ? chalk.bold.white : chalk.yellow)(m.id.padEnd(46));
      const nameCol = chalk.dim((m.name || '').slice(0, 30).padEnd(32));
      const badge = formatPlanBadge(m.plan);
      const ctx = m.contextWindow ? chalk.dim(` ${Math.round(m.contextWindow / 1000)}k ctx`) : '';
      const active = isActive ? chalk.green(' ← active') : '';
      console.log(`  ${idCol} ${badge}${ctx}${active}`);
    }
  };

  if (freeModels.length > 0) {
    console.log(chalk.bold.green('\n  Free Models\n'));
    renderGroup(freeModels);
  }
  if (otherModels.length > 0) {
    console.log(chalk.bold.cyan('\n  Paid / Preview Models\n'));
    renderGroup(otherModels);
  }
  console.log();
}

export function printWelcome(version: string): void {
  console.log(chalk.bold.blue('\n  ███╗   ███╗ █████╗ ███╗   ██╗████████╗██╗  ██╗██████╗  █████╗ '));
  console.log(chalk.bold.blue('  ████╗ ████║██╔══██╗████╗  ██║╚══██╔══╝██║  ██║██╔══██╗██╔══██╗'));
  console.log(chalk.bold.blue('  ██╔████╔██║███████║██╔██╗ ██║   ██║   ███████║██████╔╝███████║'));
  console.log(chalk.bold.blue('  ██║╚██╔╝██║██╔══██║██║╚██╗██║   ██║   ██╔══██║██╔══██╗██╔══██║'));
  console.log(chalk.bold.blue('  ██║ ╚═╝ ██║██║  ██║██║ ╚████║   ██║   ██║  ██║██║  ██║██║  ██║'));
  console.log(chalk.bold.blue('  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝'));
  console.log();
  console.log(chalk.gray(`  AI Coding Assistant v${version} — Multi-Provider CLI`));
  console.log(chalk.gray('  Run `manthra web` to configure providers and models\n'));
}

export function printPrompt(provider: string, model: string): void {
  process.stdout.write(chalk.green(`\n[${provider}:${model}] `) + chalk.bold('> '));
}

export function printError(message: string): void {
  console.log(chalk.red(`\n✗ ${message}`));
}

export function printSuccess(message: string): void {
  console.log(chalk.green(`\n✓ ${message}`));
}

export function printInfo(message: string): void {
  console.log(chalk.cyan(`\n  ${message}`));
}

export function printDivider(): void {
  console.log(chalk.gray('\n' + '─'.repeat(60)));
}

export function printUsage(inputTokens: number, outputTokens: number): void {
  console.log(chalk.dim(`\n  [${inputTokens} in / ${outputTokens} out tokens]`));
}

export function formatCode(code: string, lang?: string): string {
  return chalk.bgHex('#1a1a2e')(chalk.cyan(code));
}

export function formatMarkdown(text: string): string {
  // Code blocks first (before inline code/bold so they aren't double-processed)
  const blocks: string[] = [];
  const placeholder = '\x00BLOCK\x00';
  let processed = text.replace(/```([\w]*)\n([\s\S]+?)```/gm, (_, lang, code) => {
    const label = lang ? chalk.dim(` ${lang} `) : '';
    const lines = code.trimEnd().split('\n').map((l: string) => chalk.yellow('  ' + l));
    const block =
      chalk.dim('  ╭' + (label ? '─' + label + '─'.repeat(Math.max(1, 55 - (lang?.length ?? 0))) : '─'.repeat(58)) + '╮') + '\n' +
      lines.join('\n') + '\n' +
      chalk.dim('  ╰' + '─'.repeat(58) + '╯');
    blocks.push(block);
    return placeholder;
  });

  processed = processed
    // Thinking lines
    .replace(/^(Thought|Thinking|Reasoning):\s*(.*)$/gm,
      (_, label, t) => chalk.italic.dim(`  ${label}: ${t}`))
    // ATX headers
    .replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, content) => {
      const level = hashes.length;
      if (level === 1) return '\n' + chalk.bold.hex('#60a5fa')(content);
      if (level === 2) return '\n' + chalk.bold.hex('#34d399')(content);
      if (level === 3) return chalk.bold.hex('#fbbf24')(content);
      return chalk.bold(content);
    })
    // Horizontal rules
    .replace(/^(---|\*\*\*|___)\s*$/gm, chalk.dim('─'.repeat(58)))
    // Checkboxes
    .replace(/^\[([xX✓✔])\]\s+(.+)$/gm, (_, _c, t) => chalk.green('  ✓ ') + t)
    .replace(/^\[ \]\s+(.+)$/gm, (_, t) => chalk.dim('  ☐ ') + t)
    // Bold+italic
    .replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => chalk.bold.italic(t))
    // Bold (warm yellow to stand out)
    .replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.bold.hex('#fbbf24')(t))
    // Italic
    .replace(/\*(.+?)\*/g, (_, t) => chalk.italic(t))
    // Inline code
    .replace(/`([^`]+)`/g, (_, t) => chalk.hex('#7dd3fc')(t))
    // Unordered lists
    .replace(/^([ \t]*)[-*+]\s+(.+)$/gm, (_, indent, t) => indent + chalk.dim('  • ') + t)
    // Ordered lists
    .replace(/^([ \t]*)(\d+)\.\s+(.+)$/gm, (_, indent, n, t) => indent + chalk.dim(`  ${n}. `) + t);

  // Restore code blocks
  let bi = 0;
  processed = processed.replace(new RegExp(placeholder.replace(/\x00/g, '\\x00'), 'g'), () => blocks[bi++] ?? '');

  return processed;
}
