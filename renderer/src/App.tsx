import { useState, useEffect } from 'react';
import Header from './components/Header';
import ChatView from './components/ChatView';
import { useChat } from './hooks/useChat';

const CWD_KEY = 'manthra:cwd';

function getInitialCwd(): string {
  return localStorage.getItem(CWD_KEY) ?? '/';
}

export default function App() {
  const [cwd, setCwd] = useState(getInitialCwd);
  const chat = useChat(cwd);

  // Persist cwd whenever it changes
  useEffect(() => {
    localStorage.setItem(CWD_KEY, cwd);
  }, [cwd]);

  const handleCwdChange = async () => {
    const selected = await window.api.pickDirectory();
    if (selected) setCwd(selected);
  };

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
    </div>
  );
}
