import { contextBridge, ipcRenderer } from 'electron';
import type { StreamEvent, ConversationSummary, AppConfig } from '../main/ipc-types.js';

const api = {
  // ── Chat ─────────────────────────────────────────────────────────────────
  sendMessage: (message: string, cwd: string, conversationId?: string) =>
    ipcRenderer.invoke('chat:send', message, cwd, conversationId),

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

  // ── Event subscriptions (main → renderer) ─────────────────────────────────
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
};

contextBridge.exposeInMainWorld('api', api);
