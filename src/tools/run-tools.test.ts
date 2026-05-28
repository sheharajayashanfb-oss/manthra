import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./executor.js', () => ({
  executeTool: vi.fn(),
}));

import { runToolCalls } from './run-tools.js';
import { executeTool } from './executor.js';

const mockedExecute = vi.mocked(executeTool);

const ok = (output: string) => ({ success: true, output });

beforeEach(() => vi.clearAllMocks());

describe('runToolCalls', () => {
  it('runs agent_spawn calls in parallel', async () => {
    mockedExecute.mockImplementation(async (_name, input) => {
      const delay = (input as { delay: number }).delay;
      await new Promise((r) => setTimeout(r, delay));
      return ok(`done:${(input as { id: string }).id}`);
    });

    const calls = [
      { id: 'tc-1', name: 'agent_spawn', input: { id: 'a1', delay: 60, task: 'task 1' } },
      { id: 'tc-2', name: 'agent_spawn', input: { id: 'a2', delay: 40, task: 'task 2' } },
    ];

    const start = Date.now();
    const results = await runToolCalls(calls);
    const elapsed = Date.now() - start;

    // Parallel: should take ~60ms (longest), not 100ms (60+40)
    expect(elapsed).toBeLessThan(90);

    // Results in original call order
    expect(results[0].toolCallId).toBe('tc-1');
    expect(results[1].toolCallId).toBe('tc-2');
    expect(results[0].result.output).toBe('done:a1');
    expect(results[1].result.output).toBe('done:a2');
  });

  it('runs non-agent tools sequentially', async () => {
    const order: string[] = [];

    mockedExecute.mockImplementation(async (_name, input) => {
      await new Promise((r) => setTimeout(r, 25));
      const id = (input as { id: string }).id;
      order.push(id);
      return ok(`done:${id}`);
    });

    const calls = [
      { id: 'tc-1', name: 'bash', input: { id: 'b1', command: 'ls' } },
      { id: 'tc-2', name: 'read_file', input: { id: 'b2', path: 'foo.ts' } },
    ];

    const start = Date.now();
    await runToolCalls(calls);
    const elapsed = Date.now() - start;

    // Sequential: should take ~50ms (25+25)
    expect(elapsed).toBeGreaterThan(40);
    expect(order).toEqual(['b1', 'b2']);
  });

  it('preserves original call order in results for mixed agent + other calls', async () => {
    mockedExecute.mockResolvedValue(ok('done'));

    const calls = [
      { id: 'tc-1', name: 'agent_spawn', input: { task: 'a' } },
      { id: 'tc-2', name: 'bash', input: { command: 'ls' } },
      { id: 'tc-3', name: 'agent_spawn', input: { task: 'b' } },
    ];

    const results = await runToolCalls(calls);
    expect(results.map((r) => r.toolCallId)).toEqual(['tc-1', 'tc-2', 'tc-3']);
  });

  it('propagates tool errors correctly', async () => {
    mockedExecute.mockResolvedValue({ success: false, output: '', error: 'timeout' });

    const calls = [{ id: 'tc-1', name: 'agent_spawn', input: { task: 'fail' } }];
    const results = await runToolCalls(calls);

    expect(results[0].result.success).toBe(false);
    expect(results[0].result.error).toBe('timeout');
  });

  it('handles empty call list', async () => {
    const results = await runToolCalls([]);
    expect(results).toEqual([]);
    expect(mockedExecute).not.toHaveBeenCalled();
  });
});
