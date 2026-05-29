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
  respondToPermission: (id: string, decision: 'allow' | 'deny' | 'allow_always') =>
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

  // ── Slash commands ────────────────────────────────────────────────────────
  slashList: (): Promise<SlashCommandDef[]> => ipcRenderer.invoke('slash:list'),
  slashExec: (name: string, args: string, cwd?: string): Promise<SlashExecResult> =>
    ipcRenderer.invoke('slash:exec', name, args, cwd),
  slashListModels: (): Promise<ModelInfo[]> => ipcRenderer.invoke('slash:list-models'),
  slashListProviders: (): Promise<ProviderInfo[]> => ipcRenderer.invoke('slash:list-providers'),
  slashListTeams: (): Promise<TeamInfo[]> => ipcRenderer.invoke('slash:list-teams'),
};

contextBridge.exposeInMainWorld('api', api);
