export type PermissionDecision = 'allow' | 'always' | 'deny';

export interface PermissionCheck {
  category: string;
  label: string;
  detail: string;
}

// ── Session allow-list (cleared on exit) ─────────────────────────────────────

const _sessionAllowed = new Set<string>();

export function isSessionAllowed(category: string): boolean {
  return _sessionAllowed.has(category);
}

export function grantSession(category: string): void {
  _sessionAllowed.add(category);
}

// ── Path helpers ──────────────────────────────────────────────────────────────

function isSecretPath(p: string): boolean {
  return /\.env(\.|$)|credentials|id_rsa|id_ed25519|id_ecdsa|\.pem$|\.key$|\.pfx$|\.p12$|\/etc\/passwd|\/etc\/shadow|\.ssh\//i.test(p);
}

function isProtectedPath(p: string): boolean {
  return /^\/etc\/|^\/usr\/|^\/sys\/|^\/proc\/|^\/dev\/|^\/boot\/|(^|\/)\.git\//i.test(p);
}

function isHiddenPath(p: string): boolean {
  return /(^|\/)\.(?!\.)/.test(p);
}

// ── Classifier ────────────────────────────────────────────────────────────────

export function classifyToolCall(
  toolName: string,
  input: Record<string, unknown>,
): PermissionCheck | null {
  const path = typeof input.path === 'string' ? input.path : '';
  const url  = typeof input.url  === 'string' ? input.url  : '';

  // ── bash / run_script ────────────────────────────────────────────────────
  if (toolName === 'bash' || toolName === 'run_script') {
    const cmd = (
      typeof input.command === 'string' ? input.command :
      typeof input.script  === 'string' ? input.script  : ''
    ).trim();

    if (/rm\s+-[a-z]*r[a-z]*\s+\/|rm\s+-rf|mkfs|fdisk\s|dd\s+if=|:\(\)\s*\{/i.test(cmd))
      return { category: 'dangerous',        label: 'Dangerous / destructive command',       detail: cmd };

    if (/\.env(\s|$|")|credentials|id_rsa|id_ed25519|\.pem\b|\.key\b|\/etc\/passwd|\/etc\/shadow|\.ssh\//i.test(cmd))
      return { category: 'secret-access',    label: 'Secret / credential file access',       detail: cmd };

    if (/\bsudo\b|\bsu\s+|\bchmod\s+\+s\b|\bchown\s+root\b/i.test(cmd))
      return { category: 'system-cmd',       label: 'System-level command',                  detail: cmd };

    if (/\bdocker\b|\bdocker-compose\b|\bpodman\b/i.test(cmd))
      return { category: 'docker',           label: 'Docker command',                        detail: cmd };

    if (/\b(npm|yarn|pnpm)\s+(install|add|i)\b|\bpip3?\s+install\b|\bbrew\s+install\b|\bapt(-get)?\s+install\b|\bapk\s+add\b/i.test(cmd))
      return { category: 'package-install',  label: 'Package installation',                  detail: cmd };

    if (/\bgit\s+(push|reset|clean\s+-[a-z]*f|force-push)/i.test(cmd))
      return { category: 'git-write',        label: 'Git write / destructive operation',     detail: cmd };

    if (/\bssh\b|\bscp\b|\brsync\b.*@/i.test(cmd))
      return { category: 'ssh-access',       label: 'SSH key / remote access',               detail: cmd };

    if (/\bcurl\b|\bwget\b|\bnc\s|\bnetcat\b|\bnmap\b/i.test(cmd))
      return { category: 'network',          label: 'Internet / network access',             detail: cmd };

    if (/-p\s+\d+:\d+|--port[= ]\d+|\.listen\s*\(\s*\d+/i.test(cmd))
      return { category: 'port-bind',        label: 'Port / network binding',                detail: cmd };

    if (/[;&|]\s*$|^\s*nohup\b|^.*&\s*$/.test(cmd))
      return { category: 'background',       label: 'Background process execution',          detail: cmd };

    if (/\b(bash|sh|zsh|fish|python3?|node|ruby|perl|php)\s+\S+|\.\/([\w.-]+\.(sh|py|js|rb|pl))\b/i.test(cmd))
      return { category: 'script-exec',      label: 'Script execution',                      detail: cmd };

    if (/\bopen\s+|\bxdg-open\b|\bstart\b\s|explorer\.exe\b/i.test(cmd))
      return { category: 'gui-app',          label: 'Opening GUI / system application',      detail: cmd };

    if (/\b(psql|mysql|sqlite3|mongosh|redis-cli|clickhouse)\b/i.test(cmd))
      return { category: 'db',               label: 'Database command execution',            detail: cmd };

    return { category: 'bash',               label: 'Bash / terminal command execution',     detail: cmd };
  }

  // ── file writes ──────────────────────────────────────────────────────────
  if (toolName === 'write' || toolName === 'edit') {
    if (isSecretPath(path))    return { category: 'secret-access',  label: 'Secret / credential file access',  detail: path };
    if (isProtectedPath(path)) return { category: 'protected-path', label: 'Access to protected path',         detail: path };
    if (isHiddenPath(path))    return { category: 'hidden-dir',     label: 'Access to hidden / system directory', detail: path };
    return toolName === 'write'
      ? { category: 'file-create', label: 'File creation',              detail: path }
      : { category: 'file-edit',   label: 'File editing / modification', detail: path };
  }

  // ── file deletion / rename ───────────────────────────────────────────────
  if (toolName === 'delete_file' || toolName === 'remove_file') {
    return { category: 'file-delete', label: 'File deletion', detail: path };
  }
  if (toolName === 'move_file' || toolName === 'rename_file') {
    return { category: 'file-move', label: 'File move / rename', detail: path };
  }

  // ── reads: only flag secrets / protected ────────────────────────────────
  if (toolName === 'read') {
    if (isSecretPath(path))    return { category: 'secret-access',  label: 'Secret / credential file access',  detail: path };
    if (isProtectedPath(path)) return { category: 'protected-path', label: 'Access to protected path',         detail: path };
    if (isHiddenPath(path))    return { category: 'hidden-dir',     label: 'Access to hidden / system directory', detail: path };
    return null;
  }

  // ── network ──────────────────────────────────────────────────────────────
  if (toolName === 'web_fetch' || toolName === 'http_request' || toolName === 'search_web') {
    const target = url || String(input.query ?? input.url ?? '');
    return { category: 'network', label: 'Internet / network access', detail: target };
  }

  // ── git write ops ────────────────────────────────────────────────────────
  if (['git_push', 'git_reset', 'git_checkout', 'git_rebase', 'git_clean'].includes(toolName)) {
    return { category: 'git-write', label: 'Git write / destructive operation', detail: toolName };
  }

  // ── db ───────────────────────────────────────────────────────────────────
  if (toolName.startsWith('db_')) {
    return { category: 'db', label: 'Database command execution', detail: toolName };
  }

  // ── infra / cloud ─────────────────────────────────────────────────────────
  if (toolName.startsWith('infra_')) {
    return { category: 'system-cmd', label: 'System-level / infrastructure command', detail: toolName };
  }

  return null;
}
