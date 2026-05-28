import { executeTool } from './executor.js';
import type { ToolResult } from './types.js';

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolCallResult {
  toolCallId: string;
  result: ToolResult;
}

/**
 * Executes a list of tool calls.
 * agent_spawn calls run in parallel via Promise.all.
 * All other tools run sequentially (safe for fs/shell ops).
 * Results are returned in the original call order.
 */
export async function runToolCalls(toolCalls: ToolCall[]): Promise<ToolCallResult[]> {
  const agentCalls = toolCalls.filter((tc) => tc.name === 'agent_spawn');
  const otherCalls = toolCalls.filter((tc) => tc.name !== 'agent_spawn');

  const agentResults = await Promise.all(
    agentCalls.map(async (tc) => ({ tc, result: await executeTool(tc.name, tc.input) })),
  );

  const otherResults: Array<{ tc: ToolCall; result: ToolResult }> = [];
  for (const tc of otherCalls) {
    otherResults.push({ tc, result: await executeTool(tc.name, tc.input) });
  }

  const resultMap = new Map(
    [...agentResults, ...otherResults].map(({ tc, result }) => [tc.id, result]),
  );

  return toolCalls.map((tc) => ({ toolCallId: tc.id, result: resultMap.get(tc.id)! }));
}
