import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowUp, Square, Check, Paperclip, X, FileText, Image } from 'lucide-react';
import type { SlashCommandDef, ModelInfo, SlashExecResult } from '../env';
import type { FileAttachment } from '../types';

interface Props {
  cwd: string;
  isStreaming: boolean;
  onSend: (text: string, attachments: FileAttachment[]) => void;
  onStop: () => void;
  onSlashResult: (result: SlashExecResult) => void;
}

type MenuMode = 'slash' | 'model' | 'provider' | 'team' | 'none';

const ACCEPTED = '.txt,.md,.ts,.tsx,.js,.jsx,.py,.json,.yaml,.yml,.toml,.css,.html,.sh,.go,.rs,.java,.cpp,.c,.h,.sql,.env,.gitignore,.csv,image/*';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function readFile(file: File): Promise<FileAttachment> {
  const isImage = file.type.startsWith('image/');
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let content = e.target?.result as string;
      if (isImage) {
        // strip "data:image/jpeg;base64," prefix
        content = content.split(',')[1] ?? content;
      }
      resolve({ name: file.name, mimeType: file.type || 'text/plain', content, isImage, size: file.size });
    };
    if (isImage) reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}

export default function ChatInput({ cwd, isStreaming, onSend, onStop, onSlashResult }: Props) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [commands, setCommands] = useState<SlashCommandDef[]>([]);
  const [menuMode, setMenuMode] = useState<MenuMode>('none');
  const [menuItems, setMenuItems] = useState<Array<{ id: string; label: string; sub?: string; isCurrent?: boolean }>>([]);
  const [menuIdx, setMenuIdx] = useState(0);
  const [loadingPicker, setLoadingPicker] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { window.api.slashList().then(setCommands); }, []);
  useEffect(() => { if (!isStreaming && !executing) textareaRef.current?.focus(); }, [isStreaming, executing]);

  // Global keydown → focus textarea
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      textareaRef.current?.focus();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Slash menu
  useEffect(() => {
    if (menuMode === 'model' || menuMode === 'provider') return;
    if (value.startsWith('/') && !value.includes(' ')) {
      const query = value.slice(1).toLowerCase();
      const filtered = commands.filter((c) => c.name.startsWith(query) || query === '');
      setMenuItems(filtered.map((c) => ({ id: c.name, label: `/${c.name}`, sub: c.description })));
      setMenuMode(filtered.length > 0 ? 'slash' : 'none');
      setMenuIdx(0);
    } else {
      if (menuMode === 'slash') setMenuMode('none');
    }
  }, [value, commands, menuMode]);

  const openModelPicker = useCallback(async () => {
    setMenuMode('model'); setMenuIdx(0); setMenuItems([]); setLoadingPicker(true);
    try {
      const models = await window.api.slashListModels();
      setMenuItems(models.map((m: ModelInfo) => ({ id: m.id, label: m.id, sub: m.name, isCurrent: m.isCurrent })));
      const cur = models.findIndex((m: ModelInfo) => m.isCurrent);
      setMenuIdx(cur >= 0 ? cur : 0);
    } finally { setLoadingPicker(false); }
  }, []);

  const openProviderPicker = useCallback(async () => {
    setMenuMode('provider'); setMenuIdx(0); setMenuItems([]); setLoadingPicker(true);
    try {
      const providers = await window.api.slashListProviders();
      setMenuItems(providers.map((p) => ({ id: p.id, label: p.name, sub: p.id, isCurrent: p.isCurrent })));
      const cur = providers.findIndex((p) => p.isCurrent);
      setMenuIdx(cur >= 0 ? cur : 0);
    } finally { setLoadingPicker(false); }
  }, []);

  const openTeamPicker = useCallback(async () => {
    setMenuMode('team'); setMenuIdx(0); setMenuItems([]); setLoadingPicker(true);
    try {
      const teams = await window.api.slashListTeams();
      const items = [
        { id: '__none__', label: 'None', sub: 'Disable team mode', isCurrent: teams.every((t) => !t.isCurrent) },
        ...teams.map((t) => ({ id: t.id, label: t.name, sub: `${t.memberCount} member${t.memberCount !== 1 ? 's' : ''}${t.description ? ' · ' + t.description : ''}`, isCurrent: t.isCurrent })),
      ];
      setMenuItems(items);
      const cur = items.findIndex((i) => i.isCurrent);
      setMenuIdx(cur >= 0 ? cur : 0);
    } finally { setLoadingPicker(false); }
  }, []);

  const execSlash = useCallback(async (name: string, args: string) => {
    setExecuting(true);
    try {
      const result = await window.api.slashExec(name, args, cwd);
      if (result.kind === 'show_model_picker') { openModelPicker(); return; }
      if (result.kind === 'show_provider_picker') { openProviderPicker(); return; }
      if (result.kind === 'show_team_picker') { openTeamPicker(); return; }
      onSlashResult(result);
    } finally {
      setExecuting(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [cwd, onSlashResult, openModelPicker, openProviderPicker, openTeamPicker]);

  const selectMenuItem = useCallback((item: { id: string; label: string }) => {
    if (menuMode === 'slash') {
      const cmd = commands.find((c) => c.name === item.id);
      if (!cmd) return;
      setMenuMode('none');
      if (item.id === 'model') { setValue(''); openModelPicker(); return; }
      if (item.id === 'provider') { setValue(''); openProviderPicker(); return; }
      if (item.id === 'team') { setValue(''); openTeamPicker(); return; }
      if (cmd.args) { setValue(`/${cmd.name} `); setTimeout(() => textareaRef.current?.focus(), 0); }
      else { setValue(''); execSlash(cmd.name, ''); }
    } else if (menuMode === 'model') {
      setMenuMode('none'); setValue(''); execSlash('model', item.id);
    } else if (menuMode === 'provider') {
      setMenuMode('none'); setValue(''); execSlash('provider', item.label);
    } else if (menuMode === 'team') {
      setMenuMode('none'); setValue('');
      if (item.id === '__none__') execSlash('team', 'none');
      else execSlash('team', item.label);
    }
    setMenuIdx(0);
  }, [menuMode, commands, openModelPicker, openProviderPicker, openTeamPicker, execSlash]);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if ((!text && attachments.length === 0) || isStreaming || executing) return;

    if (text.startsWith('/') && attachments.length === 0) {
      const parts = text.slice(1).split(' ');
      const cmdName = parts[0].toLowerCase();
      const args = parts.slice(1).join(' ');
      if (cmdName === 'model' && !args) { setValue(''); openModelPicker(); return; }
      if ((cmdName === 'provider' || cmdName === 'prov') && !args) { setValue(''); openProviderPicker(); return; }
      if (cmdName === 'team' && !args) { setValue(''); openTeamPicker(); return; }
      const known = commands.find((c) => c.name === cmdName);
      if (known) {
        setValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        execSlash(cmdName, args);
        return;
      }
    }

    const toSend = attachments.slice();
    setValue('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSend(text, toSend);
  }, [value, attachments, isStreaming, executing, onSend, commands, execSlash, openModelPicker, openProviderPicker, openTeamPicker]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (menuMode !== 'none' && menuItems.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenuIdx((i) => Math.min(i + 1, menuItems.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMenuIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); if (menuItems[menuIdx]) selectMenuItem(menuItems[menuIdx]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMenuMode('none'); setValue(''); return; }
    }
    if (e.key === 'Escape' && menuMode === 'none') { setValue(''); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    setMenuIdx(0);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const read = await Promise.all(arr.map(readFile));
    setAttachments((prev) => {
      // dedupe by name
      const names = new Set(prev.map((a) => a.name));
      return [...prev, ...read.filter((f) => !names.has(f.name))];
    });
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeAttachment = (name: string) => setAttachments((a) => a.filter((f) => f.name !== name));

  const canSend = (value.trim() || attachments.length > 0) && !executing;
  const showMenu = menuMode !== 'none' && (menuItems.length > 0 || loadingPicker);

  return (
    <div style={{ position: 'relative' }}>
      {/* Slash / model / provider menu */}
      {showMenu && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
          background: '#fff', border: '1px solid #e5e5e5', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 50,
          maxHeight: 320, overflowY: 'auto',
        }}>
          {(menuMode === 'model' || menuMode === 'provider' || menuMode === 'team') && (
            <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid #f0f0f0', fontSize: 11, color: '#aaa', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {loadingPicker ? 'Loading…' : menuMode === 'model' ? 'Select model' : menuMode === 'provider' ? 'Select provider' : 'Select team'}
            </div>
          )}
          {menuItems.map((item, i) => (
            <button key={item.id} onMouseDown={(e) => { e.preventDefault(); selectMenuItem(item); }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px', border: 'none',
              borderBottom: i < menuItems.length - 1 ? '1px solid #f5f5f5' : 'none',
              cursor: 'pointer', textAlign: 'left',
              background: i === menuIdx ? '#f5f5f5' : 'transparent',
            }}>
              {(menuMode === 'model' || menuMode === 'provider' || menuMode === 'team') && (
                item.isCurrent
                  ? <Check size={12} color="#22c55e" style={{ flexShrink: 0 }} />
                  : <span style={{ width: 12, flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 13, fontWeight: menuMode === 'slash' ? 500 : 400, color: item.isCurrent ? '#22c55e' : '#111', fontFamily: menuMode === 'slash' ? 'JetBrains Mono, monospace' : 'inherit', flexShrink: 0, minWidth: menuMode === 'slash' ? 100 : undefined }}>
                {item.label}
              </span>
              {item.sub && <span style={{ fontSize: 12, color: '#aaa', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {attachments.map((file) => (
            <div key={file.name} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 8px', borderRadius: 8,
              background: '#f5f5f5', border: '1px solid #e5e5e5',
              maxWidth: 220,
            }}>
              {file.isImage ? (
                <img
                  src={`data:${file.mimeType};base64,${file.content}`}
                  alt={file.name}
                  style={{ width: 20, height: 20, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <FileText size={13} color="#aaa" style={{ flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 12, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {file.name}
              </span>
              <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }}>{formatSize(file.size)}</span>
              <button onClick={() => removeAttachment(file.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#ccc', flexShrink: 0 }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input box */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          border: `1.5px solid ${dragging ? '#aaa' : '#e0e0e0'}`,
          borderRadius: 12, background: dragging ? '#fafafa' : '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.15s',
        }}
      >
        {/* File picker button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: 'none', background: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: attachments.length > 0 ? '#555' : '#ccc',
            flexShrink: 0, marginLeft: 6, marginBottom: 10,
            transition: 'color 0.15s',
          }}
        >
          <Paperclip size={15} />
        </button>
        <input ref={fileInputRef} type="file" multiple accept={ACCEPTED} onChange={handleFileInput} style={{ display: 'none' }} />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={executing ? 'Running command…' : isStreaming ? '' : attachments.length > 0 ? 'Add a message… (optional)' : 'Message Manthra… (/ for commands)'}
          disabled={isStreaming || executing}
          rows={1}
          autoFocus
          style={{
            flex: 1, resize: 'none', background: 'transparent',
            border: 'none', outline: 'none',
            padding: '14px 0',
            fontSize: 15, color: '#111', lineHeight: 1.5,
            minHeight: 52, maxHeight: 200, overflow: 'hidden',
            fontFamily: 'inherit',
          }}
        />

        <div style={{ padding: '10px 10px 10px 0', flexShrink: 0 }}>
          {isStreaming ? (
            <button onClick={onStop} title="Stop" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button onClick={handleSend} disabled={!canSend} title="Send (Enter)" style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: canSend ? '#111' : '#f0f0f0',
              cursor: canSend ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: canSend ? '#fff' : '#bbb', transition: 'background 0.15s',
            }}>
              <ArrowUp size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
