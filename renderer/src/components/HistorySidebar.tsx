import { useState, useEffect } from 'react';
import { MessageSquare, Trash2, Search } from 'lucide-react';
import type { ConversationSummary } from '../types';
import { timeAgo } from '../lib/utils';

export default function HistorySidebar() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    window.api.getHistory().then(setConversations);
  }, []);

  const filtered = conversations.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.preview.toLowerCase().includes(search.toLowerCase()),
  );

  const now = Date.now();
  const today = filtered.filter((c) => now - c.timestamp < 86400000);
  const yesterday = filtered.filter((c) => now - c.timestamp >= 86400000 && now - c.timestamp < 172800000);
  const older = filtered.filter((c) => now - c.timestamp >= 172800000);

  const handleLoad = async (id: string) => {
    setActiveId(id);
    await window.api.loadConversation(id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await window.api.deleteConversation(id);
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const ConvItem = ({ conv }: { conv: ConversationSummary }) => {
    const isActive = activeId === conv.id;
    const isHovered = hoverId === conv.id;

    return (
      <button
        onClick={() => handleLoad(conv.id)}
        onMouseEnter={() => setHoverId(conv.id)}
        onMouseLeave={() => setHoverId(null)}
        className={`group no-drag w-full text-left px-3 py-2 rounded-lg transition-colors relative ${
          isActive ? 'bg-[#1e1e1e]' : 'hover:bg-[#191919]'
        }`}
      >
        <div className="flex items-start gap-2 pr-5">
          <MessageSquare
            size={12}
            className={`mt-0.5 shrink-0 transition-colors ${isActive ? 'text-[#aaa]' : 'text-[#404040] group-hover:text-[#666]'}`}
          />
          <div className="min-w-0">
            <p className={`text-[12px] truncate leading-tight ${isActive ? 'text-[#e8e8e8]' : 'text-[#aaa]'}`}>
              {conv.title}
            </p>
            <p className="text-[11px] text-[#454545] truncate mt-0.5">{conv.preview}</p>
            <p className="text-[10px] text-[#383838] mt-0.5">{timeAgo(conv.timestamp)}</p>
          </div>
        </div>
        {isHovered && (
          <button
            onClick={(e) => handleDelete(e, conv.id)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-[#404040] hover:text-[#f87171] transition-colors"
          >
            <Trash2 size={11} />
          </button>
        )}
      </button>
    );
  };

  const Group = ({ label, items }: { label: string; items: ConversationSummary[] }) =>
    items.length > 0 ? (
      <div className="mb-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#383838] px-3 py-1.5">{label}</p>
        <div className="space-y-0.5">
          {items.map((c) => <ConvItem key={c.id} conv={c} />)}
        </div>
      </div>
    ) : null;

  return (
    <div className="flex flex-col h-full bg-[#111] border-r border-[#1e1e1e]">
      {/* Top spacer for macOS traffic lights */}
      <div className="h-11 shrink-0 flex items-center px-3 border-b border-[#1a1a1a]">
        <p className="text-[11px] font-medium text-[#404040] uppercase tracking-[0.1em]">History</p>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-[#1a1a1a]">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#383838]" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="no-drag w-full bg-[#191919] border border-[#222] rounded-md pl-7 pr-2.5 py-1.5 text-[12px] text-[#aaa] placeholder-[#383838] focus:outline-none focus:border-[#2e2e2e] transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2 px-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <MessageSquare size={18} className="text-[#2e2e2e]" />
            <p className="text-[11px] text-[#383838]">{search ? 'No results' : 'No history'}</p>
          </div>
        ) : (
          <>
            <Group label="Today" items={today} />
            <Group label="Yesterday" items={yesterday} />
            <Group label="Earlier" items={older} />
          </>
        )}
      </div>
    </div>
  );
}
