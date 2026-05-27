import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { CONVERSATIONS_DIR } from '../config/loader.js';
import type { Message, ContentBlock } from '../providers/types.js';

export class ConversationHistory {
  private messages: Message[] = [];
  private maxMessages = 100;

  add(message: Message): void {
    this.messages.push(message);
    if (this.messages.length > this.maxMessages) {
      const system = this.messages.filter((m) => m.role === 'system');
      const rest = this.messages.filter((m) => m.role !== 'system');
      let sliced = rest.slice(-this.maxMessages + system.length);

      // Don't start with an orphaned tool_result — that would have no preceding tool_calls
      while (sliced.length > 0) {
        const first = sliced[0];
        const isToolResult =
          Array.isArray(first.content) &&
          (first.content as Array<{ type: string }>).some((b) => b.type === 'tool_result');
        if (!isToolResult) break;
        sliced = sliced.slice(1);
      }

      this.messages = [...system, ...sliced];
    }
  }

  addUser(content: string): void {
    this.add({ role: 'user', content });
  }

  addAssistant(content: string | ContentBlock[]): void {
    this.add({ role: 'assistant', content });
  }

  get(): Message[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
  }

  save(name?: string): string {
    const filename = name ?? `conversation-${Date.now()}.json`;
    const filePath = join(CONVERSATIONS_DIR, filename);
    writeFileSync(filePath, JSON.stringify(this.messages, null, 2), 'utf-8');
    return filePath;
  }

  load(filePath: string): void {
    if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as Message[];
    this.messages = data;
  }

  replace(messages: Message[]): void {
    this.messages = [...messages];
  }

  length(): number {
    return this.messages.length;
  }

  // Rough token estimate: ~4 chars per token across all message content
  estimateTokens(): number {
    let chars = 0;
    for (const m of this.messages) {
      if (typeof m.content === 'string') {
        chars += m.content.length;
      } else {
        for (const b of m.content) {
          if (b.type === 'text') chars += b.text.length;
          else if (b.type === 'tool_result') chars += b.content.length;
          else if (b.type === 'tool_call') chars += JSON.stringify(b.input).length + b.name.length;
        }
      }
    }
    return Math.ceil(chars / 4);
  }

  stats(): { total: number; byRole: Record<string, number>; estimatedTokens: number } {
    const byRole: Record<string, number> = {};
    for (const m of this.messages) {
      byRole[m.role] = (byRole[m.role] ?? 0) + 1;
    }
    return { total: this.messages.length, byRole, estimatedTokens: this.estimateTokens() };
  }
}
