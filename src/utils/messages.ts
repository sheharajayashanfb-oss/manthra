import type { Message, ContentBlock, ToolCallContent, ToolResultContent } from '../providers/types.js';

/**
 * Strip trailing assistant messages whose tool_calls have no matching
 * tool_result responses. This happens when the user aborts mid-stream —
 * the assistant message is added to history but the results never arrive,
 * causing providers to reject the next request with a 400 error.
 */
export function sanitizeMessages(messages: Message[]): Message[] {
  const result = [...messages];
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg.role !== 'assistant' || typeof msg.content === 'string') continue;
    const callIds = (msg.content as ContentBlock[])
      .filter((b) => b.type === 'tool_call')
      .map((b) => (b as ToolCallContent).id);
    if (callIds.length === 0) continue;
    const coveredIds = new Set<string>();
    for (let j = i + 1; j < result.length; j++) {
      const next = result[j];
      if (next.role !== 'user' || typeof next.content === 'string') continue;
      for (const block of next.content as ContentBlock[]) {
        if (block.type === 'tool_result') coveredIds.add((block as ToolResultContent).tool_call_id);
      }
    }
    if (!callIds.every((id) => coveredIds.has(id))) {
      result.splice(i);
      break;
    }
  }
  return result;
}
