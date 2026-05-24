import chalk from 'chalk';
import type { Tool, ToolResult } from './types.js';
import type { Provider, Message, ContentBlock, StreamEvent } from '../providers/types.js';
import { getAllTools } from './registry.js';
import { executeTool } from './executor.js';

export function createSubAgentTool(provider: Provider, model: string): Tool {
  return {
    name: 'agent_spawn',
    description:
      'Spawn a focused sub-agent to handle a self-contained subtask. ' +
      'The sub-agent runs independently with full tool access and returns its result when done. ' +
      'Use this to delegate complex, well-defined subtasks in parallel or sequentially.',
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description:
            'The task for the sub-agent to complete. Must be self-contained and specific. ' +
            'Include all context and file paths the sub-agent needs.',
        },
      },
      required: ['task'],
    },
    async execute(input): Promise<ToolResult> {
      const task = String(input['task']);
      const taskPreview = task.length > 64 ? task.slice(0, 61) + '…' : task;

      process.stdout.write('\n');
      process.stdout.write(chalk.bold.cyan('  ◆  Manthra is using a sub-agent\n'));
      process.stdout.write(chalk.dim(`     Task: ${taskPreview}\n`));
      process.stdout.write(chalk.dim('  ' + '─'.repeat(60)) + '\n');

      const toolDefs = getAllTools().map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));

      const messages: Message[] = [
        {
          role: 'system',
          content:
            'You are a focused sub-agent. Complete the assigned task efficiently using available tools. ' +
            'When finished, provide a concise summary of what you accomplished and any key results.',
        },
        { role: 'user', content: task },
      ];

      const MAX_ITER = 10;
      let iterCount = 0;
      let finalText = '';

      while (iterCount < MAX_ITER) {
        iterCount++;

        let stream: AsyncIterable<StreamEvent>;
        try {
          stream = provider.chat(messages, {
            model,
            maxTokens: 4096,
            temperature: 0,
            tools: toolDefs,
          });
        } catch (err) {
          return { success: false, output: '', error: `Sub-agent provider error: ${String(err)}` };
        }

        let text = '';
        let thinking = '';
        const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

        for await (const event of stream) {
          if (event.type === 'text_delta' && event.delta) {
            text += event.delta;
          } else if (event.type === 'thinking_delta' && event.delta) {
            thinking += event.delta;
          } else if (event.type === 'tool_call_done' && event.tool_call) {
            toolCalls.push({
              id: event.tool_call.id,
              name: event.tool_call.name,
              input: event.tool_call.input ?? {},
            });
          }
        }

        finalText = text;

        const assistantContent: ContentBlock[] = [];
        if (thinking) assistantContent.push({ type: 'thinking', thinking });
        if (text) assistantContent.push({ type: 'text', text });
        for (const tc of toolCalls) {
          assistantContent.push({ type: 'tool_call', id: tc.id, name: tc.name, input: tc.input });
        }
        if (assistantContent.length > 0) {
          messages.push({ role: 'assistant', content: assistantContent });
        }

        if (toolCalls.length === 0) break;

        const toolResultBlocks: ContentBlock[] = [];
        for (const tc of toolCalls) {
          process.stdout.write(chalk.cyan(`  ◈  `) + chalk.dim(`[sub-agent] `) + chalk.cyan(tc.name) + '\n');
          const result = await executeTool(tc.name, tc.input, { silent: true });
          const content = result.success
            ? result.output
            : `[ERROR] ${result.error ?? 'tool failed'}`;
          toolResultBlocks.push({
            type: 'tool_result',
            tool_call_id: tc.id,
            content,
            is_error: !result.success,
          });
        }

        if (toolResultBlocks.length > 0) {
          messages.push({ role: 'user', content: toolResultBlocks });
        }
      }

      process.stdout.write(chalk.dim('  ' + '─'.repeat(60)) + '\n');
      if (iterCount >= MAX_ITER) {
        process.stdout.write(chalk.yellow('  ◆  Sub-agent reached max iterations\n\n'));
      } else {
        process.stdout.write(chalk.bold.cyan('  ◆  Sub-agent done\n\n'));
      }

      return {
        success: true,
        output: finalText || '(sub-agent completed without text output)',
      };
    },
  };
}
