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
      // Keep system messages and trim oldest non-system messages
      const system = this.messages.filter((m) => m.role === 'system');
      const rest = this.messages.filter((m) => m.role !== 'system');
      this.messages = [...system, ...rest.slice(-this.maxMessages + system.length)];
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

  length(): number {
    return this.messages.length;
  }
}
