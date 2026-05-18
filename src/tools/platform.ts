import { existsSync } from 'fs';

export const isWindows = process.platform === 'win32';

// If SHELL env is set and the file exists, use it (covers Git Bash, WSL, macOS, Linux).
// On native Windows (no SHELL env), resolvedShell is null → PowerShell is used instead.
export const resolvedShell: string | null = (() => {
  const env = process.env.SHELL;
  if (env && existsSync(env)) return env;
  if (isWindows) return null;
  for (const sh of ['/bin/zsh', '/bin/bash', '/bin/sh']) {
    if (existsSync(sh)) return sh;
  }
  return null;
})();

// True only when running on native Windows without a Unix-style shell override
export const usesPowerShell = isWindows && resolvedShell === null;

export function platformSystemPrompt(): string {
  if (usesPowerShell) {
    return [
      '## Shell environment',
      '- OS: Windows',
      '- Shell: PowerShell (powershell.exe)',
      '- Always use PowerShell syntax for shell commands.',
      '- File/directory ops: Get-ChildItem (ls), New-Item (mkdir/touch), Copy-Item (cp), Move-Item (mv), Remove-Item (rm), Get-Content (cat), Set-Content, Select-String (grep)',
      '- Environment variables: $env:VAR_NAME (not $VAR_NAME or %VAR%)',
      '- Path separator is backslash (\\), though forward slashes work in most dev tools',
      '- Statement separator: use ; (works in PowerShell)',
      '- Subexpressions: $(...) works in PowerShell',
      '- Chaining: && and || are NOT supported in PowerShell 5.1 (default on Windows); use ; or if ($LASTEXITCODE -ne 0) { } instead',
      '- Arithmetic: use [int]$a + $b or [Math]::Pow(), not $(( ))',
      '- Here-strings: use @"..."@ or @\'...\'@ instead of bash here-docs',
      '- dev tools (git, npm, node, python, pip, cargo, etc.) work with their standard syntax',
    ].join('\n');
  }

  const osLabel = process.platform === 'darwin' ? 'macOS' : `Linux (${process.platform})`;
  const shell = resolvedShell ?? 'sh';
  return `## Shell environment\n- OS: ${osLabel}\n- Shell: ${shell}`;
}
