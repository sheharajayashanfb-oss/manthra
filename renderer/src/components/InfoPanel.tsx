import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { AgentState } from '../types';
import { formatTokens } from '../lib/utils';

interface Props {
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: string;
  isStreaming: boolean;
  agents: Map<string, AgentState>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-[#484848]">{label}</span>
      <span className="text-[11px] text-[#888] font-mono truncate max-w-[110px] text-right">{value || '—'}</span>
    </div>
  );
}

export default function InfoPanel({ tokensIn, tokensOut, model, provider, isStreaming, agents }: Props) {
  const agentList = [...agents.values()];
  const total = tokensIn + tokensOut;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Top spacer matching header */}
      <div className="h-11 shrink-0 flex items-center px-3 border-b border-[#1a1a1a]">
        <p className="text-[11px] font-medium text-[#404040] uppercase tracking-[0.1em]">Session</p>
      </div>

      <div className="flex-1 px-3 py-3 space-y-4">
        {/* Token counts */}
        <div>
          <div className="divide-y divide-[#1a1a1a]">
            <Row label="Tokens in" value={formatTokens(tokensIn)} />
            <Row label="Tokens out" value={formatTokens(tokensOut)} />
            <Row label="Total" value={formatTokens(total)} />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[#1a1a1a]" />

        {/* Model info */}
        <div className="divide-y divide-[#1a1a1a]">
          <Row label="Model" value={model} />
          <Row label="Provider" value={provider} />
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[11px] text-[#484848]">Status</span>
            <span className={`text-[11px] font-mono ${isStreaming ? 'text-[#5b8dd9]' : 'text-[#3d8f5f]'}`}>
              {isStreaming ? 'streaming' : 'ready'}
            </span>
          </div>
        </div>

        {/* Agents */}
        {agentList.length > 0 && (
          <>
            <div className="border-t border-[#1a1a1a]" />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#383838] mb-2">Agents</p>
              <div className="space-y-1">
                <AnimatePresence>
                  {agentList.map((agent) => (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-md"
                      style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}20` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: agent.color }} />
                      <span className="text-[11px] truncate flex-1" style={{ color: agent.color }}>
                        {agent.label}
                      </span>
                      {agent.status === 'running' && (
                        <Loader2 size={10} style={{ color: agent.color }} className="animate-spin shrink-0" />
                      )}
                      {agent.status === 'done' && (
                        <CheckCircle2 size={10} className="text-[#3d8f5f] shrink-0" />
                      )}
                      {agent.status === 'error' && (
                        <XCircle size={10} className="text-[#c0514f] shrink-0" />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
