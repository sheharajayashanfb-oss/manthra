import chalk, { type ChalkInstance } from 'chalk';
import { EventEmitter } from 'events';
import type { Tool, ToolResult } from './types.js';
import type { Provider, Message, ContentBlock, StreamEvent } from '../providers/types.js';
import { getAllTools } from './registry.js';
import { executeTool } from './executor.js';

const AGENT_COLORS: ChalkInstance[] = [
  chalk.cyan,
  chalk.magenta,
  chalk.yellow,
  chalk.green,
  chalk.blue,
  chalk.red,
];

// Hex counterparts for the renderer (same order as AGENT_COLORS)
const AGENT_COLOR_HEX = ['#06b6d4', '#d946ef', '#eab308', '#22c55e', '#3b82f6', '#ef4444'];

let agentColorIndex = 0;

// Event emitter for desktop app integration — fires alongside stdout output
export const subAgentEmitter = new EventEmitter();

export interface SubAgentStartEvent { agentId: string; task: string; label: string; color: string }
export interface SubAgentToolEvent { agentId: string; toolId: string; name: string; label: string }
export interface SubAgentToolDoneEvent { agentId: string; toolId: string; success: boolean }
export interface SubAgentDoneEvent { agentId: string; toolCount: number }
export interface SubAgentErrorEvent { agentId: string; message: string }

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
      const colorIdx = agentColorIndex % AGENT_COLORS.length;
      const agentColor = AGENT_COLORS[colorIdx];
      const agentColorHex = AGENT_COLOR_HEX[colorIdx];
      agentColorIndex++;

      const agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const task = String(input['task']);
      const memberId = input['member_id'] as string | undefined;

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

      // Box dimensions: "  │  " (5) + INNER + "  │" (3) = cols
      const cols = Math.min(process.stdout.columns ?? 80, 120);
      const INNER = Math.max(10, cols - 8);

      const wrapChars = (text: string, width: number): string[] => {
        if (text.length === 0) return [''];
        const lines: string[] = [];
        for (let i = 0; i < text.length; i += width) lines.push(text.slice(i, i + width));
        return lines;
      };

      const border = (s: string) => agentColor.dim(s);

      const boxLine = (text: string) => {
        for (const chunk of wrapChars(text, INNER)) {
          process.stdout.write(border('  │  ' + chunk.padEnd(INNER) + '  │') + '\n');
        }
      };

      const boxSep = () =>
        process.stdout.write(border('  │  ' + ' '.repeat(INNER) + '  │') + '\n');

      // Header: "  ╭─ MemberLabel · model ──────╮"
      subAgentEmitter.emit('agent:start', { agentId, task, label: memberLabel, color: agentColorHex } satisfies SubAgentStartEvent);

      const headerFill = Math.max(1, cols - memberLabel.length - spawnModel.length - 10);
      process.stdout.write('\n');
      process.stdout.write(
        border('  ╭─ ') + agentColor.bold(memberLabel) +
        border(` · ${spawnModel} `) + border('─'.repeat(headerFill) + '╮') + '\n',
      );

      // Task — full text, wrapped inside box
      boxLine(`Task: ${task}`);

      if (memberIdMismatch) {
        boxLine(`⚠  member_id "${memberIdMismatch}" not matched — using ${memberLabel}`);
      }
      if (allowedTools) {
        boxLine(`Tools: ${allowedTools.join(', ')}`);
      }
      boxSep();

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
          // Build full tool label — no truncation
          let toolLabel: string;
          if (tc.name === 'bash' || tc.name === 'run_script') {
            const cmd = String(tc.input['command'] ?? tc.input['script'] ?? '').replace(/\s+/g, ' ').trim();
            toolLabel = cmd ? `bash - ${cmd}` : tc.name;
          } else {
            toolLabel = tc.name;
          }

          subAgentEmitter.emit('agent:tool_call', { agentId, toolId: tc.id, name: tc.name, label: toolLabel } satisfies SubAgentToolEvent);

          // Print ◈ prefix + full label, wrapped inside box
          const ICON = '◈  '; // 3 visual chars
          const contentWidth = INNER - ICON.length;
          const chunks = wrapChars(toolLabel, contentWidth);
          for (let i = 0; i < chunks.length; i++) {
            const icon = i === 0 ? agentColor(ICON) : ' '.repeat(ICON.length);
            const pad = ' '.repeat(Math.max(0, contentWidth - chunks[i].length));
            process.stdout.write(border('  │  ') + icon + border(chunks[i]) + pad + border('  │') + '\n');
          }

          // Hard-enforce tool restriction — reject calls outside allowed set
          if (allowedTools && !allowedTools.includes(tc.name)) {
            boxLine(`✗  blocked: ${tc.name} not in allowed tools`);
            subAgentEmitter.emit('agent:tool_done', { agentId, toolId: tc.id, success: false } satisfies SubAgentToolDoneEvent);
            toolResultBlocks.push({
              type: 'tool_result',
              tool_call_id: tc.id,
              content: `[BLOCKED] You called "${tc.name}" but your allowed tools are: ${allowedTools.join(', ')}. You cannot use tools outside this list.`,
              is_error: true,
            });
            continue;
          }

          const result = await executeTool(tc.name, tc.input, { silent: true });
          subAgentEmitter.emit('agent:tool_done', { agentId, toolId: tc.id, success: result.success } satisfies SubAgentToolDoneEvent);
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

      subAgentEmitter.emit('agent:done', { agentId, toolCount: totalToolCalls } satisfies SubAgentDoneEvent);

      // Footer: "  ╰─ done  · N tool calls ────╯"
      boxSep();
      const toolSummaryPlain = totalToolCalls > 0
        ? `  · ${totalToolCalls} tool call${totalToolCalls !== 1 ? 's' : ''}`
        : '';
      const statusText = iterCount >= MAX_ITER ? 'max iterations reached' : 'done';
      const footerFill = Math.max(1, cols - statusText.length - toolSummaryPlain.length - 7);
      const statusColor = iterCount >= MAX_ITER ? chalk.yellow : agentColor;
      process.stdout.write(
        border('  ╰─ ') + statusColor(statusText) +
        border(`${toolSummaryPlain} `) + border('─'.repeat(footerFill) + '╯') + '\n\n',
      );

      return {
        success: true,
        output: finalText || finalThinking || '(sub-agent completed without text output)',
      };
    },
  };
}
