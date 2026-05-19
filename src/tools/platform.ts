import { existsSync } from 'fs';

export const isWindows = process.platform === 'win32';

export const resolvedShell: string | null = (() => {
  if (!isWindows) {
    return process.env['SHELL'] ?? '/bin/sh';
  }
  // On Windows, look for Git Bash or WSL bash first
  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    'C:\\Windows\\System32\\bash.exe',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null; // Falls back to PowerShell
})();

export const usesPowerShell = isWindows && resolvedShell === null;

export function platformSystemPrompt(): string {
  if (isWindows) {
    if (usesPowerShell) {
      return `You are running on Windows with PowerShell as the shell. Use PowerShell syntax for shell commands (e.g., Get-ChildItem instead of ls, Remove-Item instead of rm, Set-Content instead of echo). Avoid Unix-only commands.`;
    }
    return `You are running on Windows with Git Bash available. You can use standard Unix shell commands via bash.`;
  }
  const shellName = resolvedShell?.split('/').pop() ?? 'sh';
  return `You are running on ${process.platform} with ${shellName} as the shell. Use standard Unix shell commands.`;
}
