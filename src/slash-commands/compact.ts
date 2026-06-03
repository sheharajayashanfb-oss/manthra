import chalk from 'chalk';
import type { SlashCommand } from './types.js';
import type { Message } from '../providers/types.js';
import { startSpinner } from '../ui/spinner.js';
import { saveSessionContext } from '../memory/store.js';

function fmtTokens(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

/** Serialise history into a readable transcript for the summarisation prompt. */
function historyToTranscript(messages: Message[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    if (typeof msg.content === 'string') {
      lines.push(`${msg.role.toUpperCase()}: ${msg.content}`);
      continue;
    }
    const parts: string[] = [];
    for (const block of msg.content) {
      if (block.type === 'text' && block.text.trim()) parts.push(block.text.trim());
      else if (block.type === 'tool_call') parts.push(`[tool: ${block.name}(${JSON.stringify(block.input)})]`);
      else if (block.type === 'tool_result') parts.push(`[result: ${block.content.slice(0, 300)}${block.content.length > 300 ? '…' : ''}]`);
    }
    if (parts.length > 0) lines.push(`${msg.role.toUpperCase()}: ${parts.join(' ')}`);
  }
  return lines.join('\n\n');
}

export async function runCompact(
  history: { get(): Message[]; estimateTokens(): number; replace(m: Message[]): void },
  provider: { chat(messages: Message[], opts: Record<string, unknown>): AsyncIterable<{ type: string; delta?: string }> },
  model: string,
): Promise<{ before: number; after: number; summary: string }> {
  const before = history.estimateTokens();
  const transcript = historyToTranscript(history.get());

  const summaryMessages: Message[] = [
    {
      role: 'system',
      content:
        'You are a conversation summariser. Your job is to produce a concise but complete summary of a conversation so that an AI assistant can continue it without losing important context.',
    },
    {
      role: 'user',
      content:
        `Summarise the following conversation. Include:\n` +
        `- What the user asked or wanted to accomplish\n` +
        `- Key decisions, code written, files changed, commands run, and their outcomes\n` +
        `- Any open questions or next steps mentioned\n` +
        `- Important facts or constraints established\n\n` +
        `Be concise but don't omit anything important. Write in third-person past tense.\n\n` +
        `CONVERSATION:\n\n${transcript}`,
    },
  ];

  let summary = '';
  const stream = provider.chat(summaryMessages, { model, maxTokens: 2048, temperature: 0, tools: [] });
  for await (const event of stream) {
    if (event.type === 'text_delta' && event.delta) summary += event.delta;
  }

  if (!summary.trim()) throw new Error('Provider returned an empty summary.');

  // Replace history with a compact context injection
  const compacted: Message[] = [
    {
      role: 'user',
      content: `[Conversation compacted — summary of prior context]\n\n${summary.trim()}`,
    },
    {
      role: 'assistant',
      content: 'Understood. I have the context from our previous conversation and am ready to continue.',
    },
  ];

  history.replace(compacted);
  const after = history.estimateTokens();
  return { before, after, summary: summary.trim() };
}

export const compactCommand: SlashCommand = {
  name: 'compact',
  description: 'Summarise conversation history to free up context tokens',
  usage: '/compact',

  async handler(_args, ctx) {
    if (!ctx.provider) {
      console.log(chalk.red('\n  No provider configured.\n'));
      return;
    }
    if (ctx.history.length() === 0) {
      console.log(chalk.dim('\n  Nothing to compact — conversation is empty.\n'));
      return;
    }

    const stop = startSpinner('Compacting…');
    try {
      const { before, after, summary } = await runCompact(ctx.history, ctx.provider, ctx.model);
      saveSessionContext(summary);
      stop();
      const freed = before - after;
      const pct = before > 0 ? Math.round((freed / before) * 100) : 0;
      process.stdout.write(
        chalk.dim('\n  ✦  Compacted — ') +
        chalk.white(`~${fmtTokens(freed)} tokens freed`) +
        chalk.dim(` (${pct}%  ·  ${fmtTokens(before)} → ${fmtTokens(after)})\n\n`),
      );
    } catch (err: unknown) {
      stop();
      console.log(chalk.red(`\n  Compact failed: ${err instanceof Error ? err.message : String(err)}\n`));
    }
  },
};
