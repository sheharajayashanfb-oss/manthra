import chalk from 'chalk';
import type { Tool, ToolResult } from './types.js';
import type { Provider, Message, ContentBlock, StreamEvent } from '../providers/types.js';
import { getAllTools } from './registry.js';
import { executeTool, isVerbose } from './executor.js';

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
      let memberIdMismatch: string | null = null;

      // Unique member list (registry stores each runtime under slug + raw ID — deduplicate by reference)
      const uniqueMembers: TeamMemberRuntime[] = [];
      if (teamMembers && teamMembers.size > 0) {
        const seen = new Set<TeamMemberRuntime>();
        for (const m of teamMembers.values()) {
          if (!seen.has(m)) { seen.add(m); uniqueMembers.push(m); }
        }
      }

      if (uniqueMembers.length > 0) {
        let matched: TeamMemberRuntime | undefined;

        if (memberId) {
          // 1. Exact key match (slug or raw ID)
          matched = teamMembers!.get(memberId);

          if (!matched) {
            // 2. Normalise and try again
            const normalised = memberId.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            matched = teamMembers!.get(normalised);
          }

          if (!matched) {
            // 3. Case-insensitive name match
            const lower = memberId.toLowerCase();
            matched = uniqueMembers.find((m) => m.name.toLowerCase() === lower);
          }

          if (!matched) memberIdMismatch = memberId;
        }

        // In team mode always use a member — fall back to first when unresolved
        if (!matched) matched = uniqueMembers[0];

        spawnProvider = matched.provider;
        spawnModel = matched.model;
        if (matched.tools.length > 0) allowedTools = matched.tools;
        memberLabel = matched.name;
      }

      const BOX_W = 62;
      const modelShort = spawnModel.length > 28 ? spawnModel.slice(0, 25) + '…' : spawnModel;
      const headerText = `${memberLabel} · ${modelShort}`;
      const headerFill = Math.max(2, BOX_W - headerText.length - 5);
      process.stdout.write('\n');
      process.stdout.write(
        chalk.dim('  ╭─ ') + chalk.bold.cyan(memberLabel) +
        chalk.dim(` · ${modelShort} `) + chalk.dim('─'.repeat(headerFill)) + '\n',
      );
      process.stdout.write(chalk.dim(`  │  Task: ${taskPreview}\n`));
      if (memberIdMismatch) {
        process.stdout.write(chalk.yellow(`  │  ⚠  member_id "${memberIdMismatch}" not matched — using ${memberLabel}\n`));
      }
      if (allowedTools) {
        process.stdout.write(chalk.dim(`  │  Tools: ${allowedTools.join(', ')}\n`));
      }
      process.stdout.write(chalk.dim('  │\n'));

      const allTools = getAllTools().filter((t) => t.name !== 'agent_spawn');
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
      let finalThinking = '';
      let totalToolCalls = 0;

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
        if (thinking) finalThinking = thinking;

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
        totalToolCalls += toolCalls.length;
        for (const tc of toolCalls) {
          let toolLabel: string;
          if (tc.name === 'bash' || tc.name === 'run_script') {
            const cmd = String(tc.input['command'] ?? tc.input['script'] ?? '').replace(/\s+/g, ' ').trim();
            const preview = cmd.length > 52 ? cmd.slice(0, 49) + '…' : cmd;
            toolLabel = preview ? `bash - ${preview}` : tc.name;
          } else if (tc.name.startsWith('mcp__') && !isVerbose()) {
            toolLabel = 'Using tool';
          } else {
            toolLabel = tc.name;
          }
          process.stdout.write(chalk.dim('  │  ') + chalk.cyan('◈  ') + chalk.dim(toolLabel) + '\n');
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

      process.stdout.write(chalk.dim('  │\n'));
      const toolSummary = totalToolCalls > 0
        ? chalk.dim(`  · ${totalToolCalls} tool call${totalToolCalls !== 1 ? 's' : ''}`)
        : '';
      if (iterCount >= MAX_ITER) {
        process.stdout.write(chalk.dim('  ╰─ ') + chalk.yellow('max iterations reached') + toolSummary + '\n\n');
      } else {
        process.stdout.write(chalk.dim('  ╰─ ') + chalk.cyan('done') + toolSummary + '\n\n');
      }

      return {
        success: true,
        output: finalText || finalThinking || '(sub-agent completed without text output)',
      };
    },
  };
}
