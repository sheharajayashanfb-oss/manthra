import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Cpu, Layers, Zap, Bot, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#141414] border border-[#222]">
      <div className={`w-7 h-7 rounded-md flex items-center justify-center ${accent ? 'bg-[#8b5cf6]/15' : 'bg-[#1a1a1a]'}`}>
        <Icon size={13} className={accent ? 'text-[#8b5cf6]' : 'text-[#737373]'} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-[#4a4a4a] uppercase tracking-wide">{label}</p>
        <p className="text-xs font-medium text-[#e2e2e2] truncate">{value || '—'}</p>
      </div>
    </div>
  );
}

function TokenDonut({ tokensIn, tokensOut }: { tokensIn: number; tokensOut: number }) {
  const total = tokensIn + tokensOut;
  const data = total > 0
    ? [{ name: 'In', value: tokensIn }, { name: 'Out', value: tokensOut }]
    : [{ name: 'Empty', value: 1 }];

  return (
    <div className="flex flex-col items-center py-3">
      <div className="relative w-28 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={50}
              paddingAngle={total > 0 ? 3 : 0}
              dataKey="value"
              strokeWidth={0}
            >
              {total > 0 ? (
                <>
                  <Cell fill="#8b5cf6" />
                  <Cell fill="#6d28d9" />
                </>
              ) : (
                <Cell fill="#2e2e2e" />
              )}
            </Pie>
            {total > 0 && <Tooltip formatter={(v) => formatTokens(Number(v))} contentStyle={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 8, fontSize: 11 }} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold text-[#e2e2e2]">{formatTokens(total)}</span>
          <span className="text-[9px] text-[#4a4a4a] uppercase tracking-wide">tokens</span>
        </div>
      </div>
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#8b5cf6]" />
          <span className="text-[10px] text-[#737373]">in {formatTokens(tokensIn)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#6d28d9]" />
          <span className="text-[10px] text-[#737373]">out {formatTokens(tokensOut)}</span>
        </div>
      </div>
    </div>
  );
}

function AgentStatusList({ agents }: { agents: Map<string, AgentState> }) {
  const list = [...agents.values()];
  if (list.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4a4a4a] mb-2">Agents</p>
      <div className="space-y-1.5">
        <AnimatePresence>
          {list.map((agent) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#141414] border"
              style={{ borderColor: `${agent.color}33` }}
            >
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: agent.color }} />
              <span className="text-[11px] text-[#a1a1a1] truncate flex-1">{agent.label}</span>
              {agent.status === 'running' && <Loader2 size={11} style={{ color: agent.color }} className="animate-spin shrink-0" />}
              {agent.status === 'done' && <CheckCircle2 size={11} className="text-[#22c55e] shrink-0" />}
              {agent.status === 'error' && <XCircle size={11} className="text-[#ef4444] shrink-0" />}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function InfoPanel({ tokensIn, tokensOut, model, provider, isStreaming, agents }: Props) {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4a4a4a]">Session Info</p>

      <TokenDonut tokensIn={tokensIn} tokensOut={tokensOut} />

      <div className="space-y-2">
        <StatCard icon={Cpu} label="Model" value={model} accent />
        <StatCard icon={Layers} label="Provider" value={provider} />
        <StatCard icon={Zap} label="Status" value={isStreaming ? 'Streaming…' : 'Ready'} accent={isStreaming} />
      </div>

      <AgentStatusList agents={agents} />
    </div>
  );
}
