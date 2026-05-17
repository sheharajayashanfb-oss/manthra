import { readFileSync, writeFileSync, existsSync } from 'fs';
import { MEMORY_FILE, ensureConfigDir } from '../config/loader.js';

export interface MemoryEntry {
  id: string;
  content: string;
  createdAt: string;
  tags: string[];
}

function loadAll(): MemoryEntry[] {
  if (!existsSync(MEMORY_FILE)) return [];
  try {
    return JSON.parse(readFileSync(MEMORY_FILE, 'utf-8')) as MemoryEntry[];
  } catch {
    return [];
  }
}

function saveAll(entries: MemoryEntry[]): void {
  ensureConfigDir();
  writeFileSync(MEMORY_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

export function addMemory(content: string, tags: string[] = []): MemoryEntry {
  const entries = loadAll();
  const entry: MemoryEntry = { id: `mem_${Date.now()}`, content, createdAt: new Date().toISOString(), tags };
  entries.push(entry);
  saveAll(entries);
  return entry;
}

export function listMemory(): MemoryEntry[] {
  return loadAll();
}

export function deleteMemory(id: string): boolean {
  const entries = loadAll();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  saveAll(entries);
  return true;
}

export function clearMemory(): void {
  saveAll([]);
}

export function formatMemoryForContext(): string {
  const entries = loadAll();
  if (entries.length === 0) return '';
  return `## Memory\n${entries.map((e) => `- ${e.content}`).join('\n')}`;
}
