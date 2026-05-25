import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const VERSION_URL = 'https://manthra.informaticsint.au/version.json';
const CACHE_FILE = join(homedir(), '.manthra', 'update-check.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateCache {
  lastCheck: number;
  latestVersion: string;
}

function readCache(): UpdateCache | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as UpdateCache;
  } catch {
    return null;
  }
}

function writeCache(data: UpdateCache): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf-8');
  } catch {
    // ignore — cache failure is non-critical
  }
}

function isNewer(latest: string, current: string): boolean {
  const pa = latest.replace(/^v/, '').split('.').map(Number);
  const pb = current.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff > 0) return true;
    if (diff < 0) return false;
  }
  return false;
}

export async function checkForUpdate(currentVersion: string): Promise<string | null> {
  try {
    const cache = readCache();
    const now = Date.now();

    if (cache && now - cache.lastCheck < CACHE_TTL) {
      return isNewer(cache.latestVersion, currentVersion) ? cache.latestVersion : null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(VERSION_URL, { signal: controller.signal });
    clearTimeout(timer);

    const data = (await res.json()) as { version: string };
    const latest = data.version.replace(/^v/, '');

    writeCache({ lastCheck: now, latestVersion: latest });

    return isNewer(latest, currentVersion) ? latest : null;
  } catch {
    return null;
  }
}
