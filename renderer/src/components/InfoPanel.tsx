import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Download, RefreshCw, Terminal } from 'lucide-react';
import { useState, useEffect } from 'react';
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

type UpdateStatus = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'error';

function UpdatePanel() {
  const [versions, setVersions] = useState<{ current: string; latest: string | null } | null>(null);
  const [appStatus, setAppStatus] = useState<UpdateStatus>('idle');
  const [appVersion, setAppVersion] = useState('');
  const [appPercent, setAppPercent] = useState(0);
  const [appError, setAppError] = useState('');
  const [cliStatus, setCliStatus] = useState<'idle' | 'updating' | 'done' | 'error'>('idle');
  const [cliMsg, setCliMsg] = useState('');

  useEffect(() => {
    window.api.getVersions().then(setVersions);
    const unsub = window.api.onUpdateEvent((e) => {
      if (e.type === 'checking') setAppStatus('checking');
      else if (e.type === 'available') { setAppStatus('available'); setAppVersion(e.version ?? ''); }
      else if (e.type === 'current') setAppStatus('current');
      else if (e.type === 'progress') { setAppStatus('downloading'); setAppPercent(e.percent ?? 0); }
      else if (e.type === 'ready') { setAppStatus('ready'); setAppVersion(e.version ?? ''); }
      else if (e.type === 'error') { setAppStatus('error'); setAppError(e.message ?? ''); }
    });
    return unsub;
  }, []);

  const checkApp = () => { setAppStatus('checking'); window.api.checkAppUpdate(); };
  const downloadApp = () => { setAppStatus('downloading'); window.api.downloadAppUpdate(); };
  const installApp = () => window.api.installAppUpdate();

  const updateCli = async () => {
    setCliStatus('updating'); setCliMsg('');
    const res = await window.api.updateCli();
    if (res.ok) { setCliStatus('done'); setCliMsg('CLI updated successfully'); }
    else { setCliStatus('error'); setCliMsg(res.error ?? 'Failed'); }
  };

  const hasUpdate = versions && versions.latest && versions.latest !== versions.current;

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#383838]">Updates</p>

      {/* Version info */}
      <div className="divide-y divide-[#1a1a1a]">
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px] text-[#484848]">Current</span>
          <span className="text-[11px] text-[#888] font-mono">{versions?.current ?? '…'}</span>
        </div>
        {versions?.latest && (
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[11px] text-[#484848]">Latest</span>
            <span className={`text-[11px] font-mono ${hasUpdate ? 'text-[#f59e0b]' : 'text-[#3d8f5f]'}`}>
              {versions.latest}
            </span>
          </div>
        )}
      </div>

      {/* Desktop app update */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-[#555]">Desktop App</p>
        {appStatus === 'idle' && (
          <button onClick={checkApp} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] bg-[#1a1a1a] hover:bg-[#222] text-[#888] transition-colors">
            <RefreshCw size={10} /> Check for update
          </button>
        )}
        {appStatus === 'checking' && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#666] py-1">
            <Loader2 size={10} className="animate-spin" /> Checking…
          </div>
        )}
        {appStatus === 'current' && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#3d8f5f] py-1">
            <CheckCircle2 size={10} /> Up to date
          </div>
        )}
        {appStatus === 'available' && (
          <button onClick={downloadApp} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] bg-[#1a3a1a] hover:bg-[#1f4a1f] text-[#4ade80] transition-colors">
            <Download size={10} /> Download v{appVersion}
          </button>
        )}
        {appStatus === 'downloading' && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-[#5b8dd9] py-0.5">
              <Loader2 size={10} className="animate-spin" /> Downloading… {appPercent}%
            </div>
            <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full bg-[#5b8dd9] transition-all duration-300" style={{ width: `${appPercent}%` }} />
            </div>
          </div>
        )}
        {appStatus === 'ready' && (
          <button onClick={installApp} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] bg-[#1a1a3a] hover:bg-[#222248] text-[#818cf8] transition-colors">
            <Download size={10} /> Restart & install v{appVersion}
          </button>
        )}
        {appStatus === 'error' && (
          <div className="text-[11px] text-[#c0514f] py-1" title={appError}>
            <XCircle size={10} className="inline mr-1" />Update failed
          </div>
        )}
      </div>

      {/* CLI update */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-[#555]">Terminal CLI</p>
        {cliStatus === 'idle' && (
          <button onClick={updateCli} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] bg-[#1a1a1a] hover:bg-[#222] text-[#888] transition-colors">
            <Terminal size={10} /> Update CLI binary
          </button>
        )}
        {cliStatus === 'updating' && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#666] py-1">
            <Loader2 size={10} className="animate-spin" /> Installing…
          </div>
        )}
        {cliStatus === 'done' && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#3d8f5f] py-1">
            <CheckCircle2 size={10} /> {cliMsg}
          </div>
        )}
        {cliStatus === 'error' && (
          <div className="text-[11px] text-[#c0514f] py-1" title={cliMsg}>
            <XCircle size={10} className="inline mr-1" />Failed
          </div>
        )}
        {(cliStatus === 'done' || cliStatus === 'error') && (
          <button onClick={() => setCliStatus('idle')} className="text-[10px] text-[#444] underline">retry</button>
        )}
      </div>
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

        {/* Updates */}
        <div className="border-t border-[#1a1a1a]" />
        <UpdatePanel />
      </div>
    </div>
  );
}
