import { contextBridge, ipcRenderer } from 'electron';
import type { StreamEvent, ConversationSummary, AppConfig, SlashCommandDef, SlashExecResult, ModelInfo, ProviderInfo, TeamInfo } from '../../src/electron/bridge.js';

const api = {
  // ── Chat ─────────────────────────────────────────────────────────────────
  sendMessage: (message: string, cwd: string, attachments?: unknown[]) => ipcRenderer.invoke('chat:send', message, cwd, attachments),
  stopChat: () => ipcRenderer.invoke('chat:stop'),
  newChat: () => ipcRenderer.invoke('chat:new'),

  // ── Directory ─────────────────────────────────────────────────────────────
  pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('dir:pick'),

  // ── History ───────────────────────────────────────────────────────────────
  getHistory: (): Promise<ConversationSummary[]> => ipcRenderer.invoke('history:list'),
  loadConversation: (id: string) => ipcRenderer.invoke('history:load', id),
  deleteConversation: (id: string) => ipcRenderer.invoke('history:delete', id),

  // ── Config ────────────────────────────────────────────────────────────────
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),

  // ── Permissions ───────────────────────────────────────────────────────────
  respondToPermission: (id: string, decision: 'allow' | 'always' | 'project' | 'deny') =>
    ipcRenderer.invoke('permission:respond', id, decision),

  // ── Stream events ─────────────────────────────────────────────────────────
  onStreamEvent: (cb: (event: StreamEvent) => void) => {
    const handler = (_: unknown, event: StreamEvent) => cb(event);
    ipcRenderer.on('stream:event', handler);
    return () => ipcRenderer.removeListener('stream:event', handler);
  },
  onPermissionRequest: (cb: (req: { id: string; tool: string; action: string; details: string }) => void) => {
    const handler = (_: unknown, req: unknown) => cb(req as { id: string; tool: string; action: string; details: string });
    ipcRenderer.on('permission:request', handler);
    return () => ipcRenderer.removeListener('permission:request', handler);
  },
  onConfirmRequest: (cb: (req: { id: string; action: string; details: string }) => void) => {
    const handler = (_: unknown, req: unknown) => cb(req as { id: string; action: string; details: string });
    ipcRenderer.on('confirm:request', handler);
    return () => ipcRenderer.removeListener('confirm:request', handler);
  },
  respondToConfirm: (id: string, confirmed: boolean) =>
    ipcRenderer.invoke('confirm:respond', id, confirmed),

  // ── Slash commands ────────────────────────────────────────────────────────
  slashList: (): Promise<SlashCommandDef[]> => ipcRenderer.invoke('slash:list'),
  slashExec: (name: string, args: string, cwd?: string): Promise<SlashExecResult> =>
    ipcRenderer.invoke('slash:exec', name, args, cwd),
  slashListModels: (): Promise<ModelInfo[]> => ipcRenderer.invoke('slash:list-models'),
  slashListProviders: (): Promise<ProviderInfo[]> => ipcRenderer.invoke('slash:list-providers'),
  slashListTeams: (): Promise<TeamInfo[]> => ipcRenderer.invoke('slash:list-teams'),

  // ── Updates ───────────────────────────────────────────────────────────────
  getVersions: (): Promise<{ current: string; latest: string | null }> =>
    ipcRenderer.invoke('update:get-versions'),
  checkAppUpdate: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('update:check-app'),
  downloadAppUpdate: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('update:download-app'),
  installAppUpdate: (): Promise<void> =>
    ipcRenderer.invoke('update:install-app'),
  updateCli: (): Promise<{ ok: boolean; output?: string; error?: string }> =>
    ipcRenderer.invoke('update:cli'),
  onUpdateEvent: (cb: (event: { type: string; version?: string; percent?: number; message?: string }) => void) => {
    const handler = (_: unknown, event: unknown) => cb(event as { type: string; version?: string; percent?: number; message?: string });
    ipcRenderer.on('update:event', handler);
    return () => ipcRenderer.removeListener('update:event', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
