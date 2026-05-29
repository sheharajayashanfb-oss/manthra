import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import ChatView from './components/ChatView';
import PermissionDialog, { type PermissionDecision } from './components/PermissionDialog';
import ConfirmDialog from './components/ConfirmDialog';
import { useChat } from './hooks/useChat';

const CWD_KEY = 'manthra:cwd';

function getInitialCwd(): string {
  return localStorage.getItem(CWD_KEY) ?? '/';
}

interface PermissionRequest {
  id: string;
  tool: string;
  action: string;
  details: string;
}

interface ConfirmRequest {
  id: string;
  action: string;
  details: string;
}

export default function App() {
  const [cwd, setCwd] = useState(getInitialCwd);
  const chat = useChat(cwd);
  const [version, setVersion] = useState('');
  const [permQueue, setPermQueue] = useState<PermissionRequest[]>([]);
  const [confirmQueue, setConfirmQueue] = useState<ConfirmRequest[]>([]);

  useEffect(() => {
    localStorage.setItem(CWD_KEY, cwd);
  }, [cwd]);

  useEffect(() => {
    window.api.getVersions().then((v) => setVersion(v.current)).catch(() => {});

    const unsubPerm = window.api.onPermissionRequest((req) => {
      setPermQueue((q) => [...q, req]);
    });
    const unsubConfirm = window.api.onConfirmRequest((req) => {
      setConfirmQueue((q) => [...q, req]);
    });
    return () => { unsubPerm(); unsubConfirm(); };
  }, []);

  const handleCwdChange = async () => {
    const selected = await window.api.pickDirectory();
    if (selected) setCwd(selected);
  };

  const handlePermRespond = useCallback((id: string, decision: PermissionDecision) => {
    window.api.respondToPermission(id, decision);
    setPermQueue((q) => q.filter((r) => r.id !== id));
  }, []);

  const handleConfirmRespond = useCallback((id: string, confirmed: boolean) => {
    window.api.respondToConfirm(id, confirmed);
    setConfirmQueue((q) => q.filter((r) => r.id !== id));
  }, []);

  const currentPermission = permQueue[0] ?? null;
  const currentConfirm = confirmQueue[0] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', overflow: 'hidden' }}>
      <Header
        cwd={cwd}
        onCwdChange={handleCwdChange}
        model={chat.model}
        team={chat.team}
        onNewChat={chat.newChat}
        tokensIn={chat.tokensIn}
        tokensOut={chat.tokensOut}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ChatView
          cwd={cwd}
          messages={chat.messages}
          agents={chat.agents}
          isStreaming={chat.isStreaming}
          onSend={chat.sendMessage}
          onStop={chat.stopChat}
          onSlashResult={chat.handleSlashResult}
        />
      </div>

      {/* Version badge — bottom right */}
      {version && (
        <div style={{
          position: 'fixed', bottom: 10, right: 14,
          fontSize: 10, color: '#d1d5db',
          fontFamily: 'JetBrains Mono, monospace',
          userSelect: 'none', pointerEvents: 'none',
          zIndex: 100,
        }}>
          v{version}
        </div>
      )}

      {/* Permission dialog — shows one at a time, queued */}
      {currentPermission && (
        <PermissionDialog
          request={currentPermission}
          onRespond={handlePermRespond}
        />
      )}

      {/* Confirm dialog (confirm_action tool) */}
      {!currentPermission && currentConfirm && (
        <ConfirmDialog
          request={currentConfirm}
          onRespond={handleConfirmRespond}
        />
      )}
    </div>
  );
}
