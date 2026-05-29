import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import ChatView from './components/ChatView';
import PermissionDialog, { type PermissionDecision } from './components/PermissionDialog';
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

export default function App() {
  const [cwd, setCwd] = useState(getInitialCwd);
  const chat = useChat(cwd);
  const [version, setVersion] = useState('');
  const [permQueue, setPermQueue] = useState<PermissionRequest[]>([]);

  useEffect(() => {
    localStorage.setItem(CWD_KEY, cwd);
  }, [cwd]);

  useEffect(() => {
    window.api.getVersions().then((v) => setVersion(v.current)).catch(() => {});

    const unsub = window.api.onPermissionRequest((req) => {
      setPermQueue((q) => [...q, req]);
    });
    return unsub;
  }, []);

  const handleCwdChange = async () => {
    const selected = await window.api.pickDirectory();
    if (selected) setCwd(selected);
  };

  const handlePermRespond = useCallback((id: string, decision: PermissionDecision) => {
    window.api.respondToPermission(id, decision);
    setPermQueue((q) => q.filter((r) => r.id !== id));
  }, []);

  const currentPermission = permQueue[0] ?? null;

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
    </div>
  );
}
