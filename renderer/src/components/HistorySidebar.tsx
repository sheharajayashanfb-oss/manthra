import { useState, useEffect } from 'react';
import { Search, MessageSquare, Trash2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ConversationSummary } from '../types';
import { timeAgo } from '../lib/utils';

export default function HistorySidebar() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    window.api.getHistory().then(setConversations);
  }, []);

  const filtered = conversations.filter(
    (c) => c.title.toLowerCase().includes(search.toLowerCase()) || c.preview.toLowerCase().includes(search.toLowerCase()),
  );

  // Group by time
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
  };

  const ConvItem = ({ conv }: { conv: ConversationSummary }) => (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => handleLoad(conv.id)}
      className={`group w-full text-left px-3 py-2.5 rounded-lg transition-all ${
        activeId === conv.id ? 'bg-[#1e1b2e] border border-[#8b5cf6]/30' : 'hover:bg-[#1a1a1a]'
      }`}
    >
      <div className="flex items-start gap-2">
        <MessageSquare size={13} className="mt-0.5 shrink-0 text-[#4a4a4a] group-hover:text-[#8b5cf6] transition-colors" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#e2e2e2] truncate leading-tight">{conv.title}</p>
          <p className="text-xs text-[#4a4a4a] truncate mt-0.5">{conv.preview}</p>
        </div>
        <button
          onClick={(e) => handleDelete(e, conv.id)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-[#ef4444] text-[#4a4a4a] transition-all"
        >
          <Trash2 size={11} />
        </button>
      </div>
      <div className="flex items-center gap-1 mt-1 pl-5">
        <Clock size={10} className="text-[#4a4a4a]" />
        <span className="text-[10px] text-[#4a4a4a]">{timeAgo(conv.timestamp)}</span>
      </div>
    </motion.button>
  );

  const Group = ({ label, items }: { label: string; items: ConversationSummary[] }) =>
    items.length > 0 ? (
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4a4a4a] px-3 py-1.5">{label}</p>
        <div className="space-y-0.5">
          {items.map((c) => <ConvItem key={c.id} conv={c} />)}
        </div>
      </div>
    ) : null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[#2e2e2e]">
        <p className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-2">History</p>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4a4a4a]" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-md pl-7 pr-3 py-1.5 text-xs text-[#e2e2e2] placeholder-[#4a4a4a] focus:outline-none focus:border-[#8b5cf6] transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <AnimatePresence>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#4a4a4a]">
              <MessageSquare size={20} className="mb-2 opacity-40" />
              <p className="text-xs">No conversations yet</p>
            </div>
          ) : (
            <>
              <Group label="Today" items={today} />
              <Group label="Yesterday" items={yesterday} />
              <Group label="Earlier" items={older} />
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
