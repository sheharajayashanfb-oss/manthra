import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DIR  = '.manthra';
const FILE = 'settings.local.json';

interface ProjectSettings {
  allowedCategories: string[];
}

function settingsPath(): string {
  return join(process.cwd(), DIR, FILE);
}

function load(): ProjectSettings {
  try {
    if (existsSync(settingsPath())) {
      return JSON.parse(readFileSync(settingsPath(), 'utf8')) as ProjectSettings;
    }
  } catch { /* ignore malformed file */ }
  return { allowedCategories: [] };
}

function save(s: ProjectSettings): void {
  const dir = join(process.cwd(), DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(settingsPath(), JSON.stringify(s, null, 2) + '\n', 'utf8');
}

export function isProjectAllowed(category: string): boolean {
  return load().allowedCategories.includes(category);
}

export function grantProject(category: string): void {
  const s = load();
  if (!s.allowedCategories.includes(category)) {
    s.allowedCategories.push(category);
    save(s);
  }
}

export function revokeProject(category: string): void {
  const s = load();
  s.allowedCategories = s.allowedCategories.filter(c => c !== category);
  save(s);
}

export function getProjectAllowed(): string[] {
  return load().allowedCategories;
}
