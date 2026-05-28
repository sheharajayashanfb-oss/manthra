import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Square, Paperclip, AtSign } from 'lucide-react';

interface Props {
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export default function ChatInput({ isStreaming, onSend, onStop }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || isStreaming) return;
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSend(text);
  }, [value, isStreaming, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-grow
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

  return (
    <div className="relative">
      <div
        className={`flex items-end gap-2 rounded-xl border bg-[#141414] transition-all ${
          isStreaming ? 'border-[#8b5cf6]/40' : 'border-[#2e2e2e] focus-within:border-[#8b5cf6]/60'
        }`}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'Manthra is thinking…' : 'Ask Manthra anything… (Shift+Enter for new line)'}
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none bg-transparent px-4 py-3 text-sm text-[#e2e2e2] placeholder-[#4a4a4a] focus:outline-none disabled:opacity-50 min-h-[46px] max-h-[200px] leading-relaxed"
          style={{ overflow: 'hidden' }}
        />

        <div className="flex items-center gap-1 pr-2 pb-2">
          {/* Stop or Send */}
          {isStreaming ? (
            <motion.button
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              onClick={onStop}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] transition-colors"
              title="Stop generation"
            >
              <Square size={14} fill="currentColor" />
            </motion.button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!value.trim()}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:bg-[#2e2e2e] disabled:text-[#4a4a4a] text-white transition-all"
              title="Send (Enter)"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-[#4a4a4a] text-center mt-2">
        Manthra may make mistakes. Verify important outputs.
      </p>
    </div>
  );
}
