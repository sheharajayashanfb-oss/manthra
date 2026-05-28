import { useState } from 'react';
import Header from './components/Header';
import HistorySidebar from './components/HistorySidebar';
import ChatView from './components/ChatView';
import InfoPanel from './components/InfoPanel';
import { useChat } from './hooks/useChat';

const DEFAULT_CWD = '/';

export default function App() {
  const [cwd, setCwd] = useState(DEFAULT_CWD);
  const chat = useChat(cwd);

  const handleCwdChange = async () => {
    const selected = await window.api.pickDirectory();
    if (selected) setCwd(selected);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-[#e2e2e2] select-none overflow-hidden">
      <Header
        cwd={cwd}
        onCwdChange={handleCwdChange}
        model={chat.model}
        provider={chat.provider}
        onNewChat={chat.newChat}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left — History (fixed width, resizable via CSS var) */}
        <div className="w-60 shrink-0 border-r border-[#2e2e2e] flex flex-col overflow-hidden">
          <HistorySidebar />
        </div>

        {/* Center — Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatView
            messages={chat.messages}
            agents={chat.agents}
            isStreaming={chat.isStreaming}
            onSend={chat.sendMessage}
            onStop={chat.stopChat}
          />
        </div>

        {/* Right — Info */}
        <div className="w-56 shrink-0 border-l border-[#2e2e2e] flex flex-col overflow-hidden">
          <InfoPanel
            tokensIn={chat.tokensIn}
            tokensOut={chat.tokensOut}
            model={chat.model}
            provider={chat.provider}
            isStreaming={chat.isStreaming}
            agents={chat.agents}
          />
        </div>
      </div>
    </div>
  );
}
