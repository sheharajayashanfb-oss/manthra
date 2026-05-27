import { describe, it, expect } from 'vitest';
import { sanitizeMessages } from './messages.js';
import type { Message } from '../providers/types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

const sys: Message = { role: 'system', content: 'You are helpful.' };

const userMsg = (text: string): Message => ({ role: 'user', content: text });

const assistantText = (text: string): Message => ({
  role: 'assistant',
  content: [{ type: 'text', text }],
});

const assistantWithCalls = (ids: string[]): Message => ({
  role: 'assistant',
  content: [
    { type: 'text', text: 'Using tools...' },
    ...ids.map((id) => ({ type: 'tool_call' as const, id, name: 'bash', input: { command: 'ls' } })),
  ],
});

const toolResults = (ids: string[]): Message => ({
  role: 'user',
  content: ids.map((id) => ({ type: 'tool_result' as const, tool_call_id: id, content: 'ok' })),
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('sanitizeMessages', () => {

  it('passes through clean history with no tool calls', () => {
    const msgs: Message[] = [sys, userMsg('hello'), assistantText('hi there')];
    expect(sanitizeMessages(msgs)).toEqual(msgs);
  });

  it('passes through complete tool call / result pair', () => {
    const msgs: Message[] = [
      sys,
      userMsg('list files'),
      assistantWithCalls(['tc-1']),
      toolResults(['tc-1']),
      assistantText('Done.'),
    ];
    expect(sanitizeMessages(msgs)).toEqual(msgs);
  });

  it('removes orphaned assistant tool_call with no results (ESC abort)', () => {
    const msgs: Message[] = [
      sys,
      userMsg('run something'),
      assistantWithCalls(['tc-1']),
      // user never got a chance to send tool_result — aborted
    ];
    const result = sanitizeMessages(msgs);
    expect(result).toHaveLength(2);
    expect(result[result.length - 1]).toEqual(userMsg('run something'));
  });

  it('removes orphaned tool_call even when partially covered (2 calls, 1 result)', () => {
    const msgs: Message[] = [
      sys,
      userMsg('do two things'),
      assistantWithCalls(['tc-1', 'tc-2']),
      toolResults(['tc-1']), // tc-2 missing
    ];
    const result = sanitizeMessages(msgs);
    // should strip from the bad assistant message onwards
    expect(result).toHaveLength(2);
    expect(result[result.length - 1]).toEqual(userMsg('do two things'));
  });

  it('passes through multiple complete tool call rounds', () => {
    const msgs: Message[] = [
      sys,
      userMsg('step 1'),
      assistantWithCalls(['tc-1']),
      toolResults(['tc-1']),
      assistantWithCalls(['tc-2']),
      toolResults(['tc-2']),
      assistantText('All done.'),
    ];
    expect(sanitizeMessages(msgs)).toEqual(msgs);
  });

  it('removes only the last incomplete round, keeps prior complete rounds', () => {
    const msgs: Message[] = [
      sys,
      userMsg('multi-step'),
      assistantWithCalls(['tc-1']),
      toolResults(['tc-1']),
      assistantWithCalls(['tc-2']), // aborted — no result
    ];
    const result = sanitizeMessages(msgs);
    expect(result).toHaveLength(4); // system + user + assistant + result for tc-1
    expect(result[result.length - 1]).toEqual(toolResults(['tc-1']));
  });

  it('does not touch assistant messages with no tool calls', () => {
    const msgs: Message[] = [
      sys,
      userMsg('hi'),
      assistantText('hello'),
      userMsg('bye'),
      assistantText('goodbye'),
    ];
    expect(sanitizeMessages(msgs)).toEqual(msgs);
  });

  it('handles assistant message with string content (no tool calls)', () => {
    const msgs: Message[] = [
      sys,
      userMsg('plain text'),
      { role: 'assistant', content: 'just a string response' },
    ];
    expect(sanitizeMessages(msgs)).toEqual(msgs);
  });

  it('does not mutate the original array', () => {
    const msgs: Message[] = [
      sys,
      userMsg('test'),
      assistantWithCalls(['tc-1']),
    ];
    const original = [...msgs];
    sanitizeMessages(msgs);
    expect(msgs).toEqual(original);
  });

  it('handles empty message array', () => {
    expect(sanitizeMessages([])).toEqual([]);
  });

});
