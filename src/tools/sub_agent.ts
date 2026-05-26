import chalk from 'chalk';
import type { Tool, ToolResult } from './types.js';
import type { Provider, Message, ContentBlock, StreamEvent } from '../providers/types.js';
import { getAllTools } from './registry.js';
import { executeTool } from './executor.js';

export interface TeamMemberRuntime {
  provider: Provider;
  model: string;
  tools: string[]; // empty = all tools
  name: string;
  role: string;
}

export function createSubAgentTool(
  defaultProvider: Provider,
  defaultModel: string,
  teamMembers?: Map<string, TeamMemberRuntime>,
): Tool {
  return {
    name: 'agent_spawn',
    description:
      'Spawn a focused sub-agent to handle a self-contained subtask. ' +
      'The sub-agent runs independently with full tool access and returns its result when done. ' +
      'Use this to delegate complex, well-defined subtasks in parallel or sequentially.' +
      (teamMembers && teamMembers.size > 0
        ? ' When using a team, pass member_id to spawn a specific team member with their assigned provider and tools.'
        : ''),
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description:
            'The task for the sub-agent to complete. Must be self-contained and specific. ' +
            'Include all context and file paths the sub-agent needs.',
        },
        member_id: {
          type: 'string',
          description: 'Team member ID to spawn (uses their assigned provider, model, and tools).',
        },
      },
      required: ['task'],
    },
    async execute(input): Promise<ToolResult> {
      const task = String(input['task']);
      const memberId = input['member_id'] as string | undefined;
      const taskPreview = task.length > 64 ? task.slice(0, 61) + '…' : task;

      // Resolve provider, model, and tool restrictions
      let spawnProvider = defaultProvider;
      let spawnModel = defaultModel;
      let allowedTools: string[] | null = null;
      let memberLabel = 'sub-agent';

      if (memberId && teamMembers?.has(memberId)) {
        const member = teamMembers.get(memberId)!;
        spawnProvider = member.provider;
        spawnModel = member.model;
        if (member.tools.length > 0) allowedTools = member.tools;
        memberLabel = member.name;
      }

      process.stdout.write('\n');
      process.stdout.write(chalk.bold.cyan(`  ◆  Spawning ${memberLabel}\n`));
      process.stdout.write(chalk.dim(`     Task: ${taskPreview}\n`));
      if (allowedTools) {
        process.stdout.write(chalk.dim(`     Tools: ${allowedTools.join(', ')}\n`));
      }
      process.stdout.write(chalk.dim('  ' + '─'.repeat(60)) + '\n');

      const allTools = getAllTools();
      const toolDefs = (allowedTools
        ? allTools.filter((t) => allowedTools!.includes(t.name))
        : allTools
      ).map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }));

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
          stream = spawnProvider.chat(messages, {
            model: spawnModel,
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
          process.stdout.write(chalk.cyan(`  ◈  `) + chalk.dim(`[${memberLabel}] `) + chalk.cyan(tc.name) + '\n');
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
        process.stdout.write(chalk.yellow(`  ◆  ${memberLabel} reached max iterations\n\n`));
      } else {
        process.stdout.write(chalk.bold.cyan(`  ◆  ${memberLabel} done\n\n`));
      }

      return {
        success: true,
        output: finalText || '(sub-agent completed without text output)',
      };
    },
  };
}
