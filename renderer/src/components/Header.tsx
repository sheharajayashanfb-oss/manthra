import { FolderOpen, Plus, Users } from 'lucide-react';
import { formatTokens } from '../lib/utils';

interface HeaderProps {
  cwd: string;
  onCwdChange: () => void;
  model: string;
  team: string;
  onNewChat: () => void;
  tokensIn: number;
  tokensOut: number;
}

export default function Header({ cwd, onCwdChange, model, team, onNewChat, tokensIn, tokensOut }: HeaderProps) {
  const dirName = cwd.split('/').filter(Boolean).pop() ?? '/';
  const total = tokensIn + tokensOut;

  return (
    <header
      className="titlebar-drag"
      style={{
        display: 'flex', alignItems: 'center',
        height: 44, flexShrink: 0,
        borderBottom: '1px solid #ebebeb',
        background: '#fff',
        paddingLeft: 80, paddingRight: 16,
      }}
    >
      {/* Brand + cwd */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: '#000', userSelect: 'none' }}>
          MANTHRA
        </span>
        <span style={{ color: '#ddd', fontSize: 13 }}>·</span>
        <button
          onClick={onCwdChange}
          className="no-drag"
          title={cwd}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            height: 26, padding: '0 8px', borderRadius: 6,
            border: '1px solid #ebebeb', background: '#fafafa',
            cursor: 'pointer', fontSize: 12, color: '#666',
            maxWidth: 180, overflow: 'hidden',
          }}
        >
          <FolderOpen size={11} style={{ flexShrink: 0, color: '#aaa' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dirName}</span>
        </button>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {total > 0 && (
          <span style={{ fontSize: 11, color: '#ccc', fontFamily: 'JetBrains Mono, monospace' }}>
            {formatTokens(total)}
          </span>
        )}

        {team && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 8px', height: 26, borderRadius: 6, border: '1px solid #dbeafe', background: '#eff6ff' }}>
            <Users size={10} color="#3b82f6" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#3b82f6', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team}</span>
          </div>
        )}

        {model && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 8px', height: 26, borderRadius: 6, border: '1px solid #ebebeb', background: '#fafafa' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#666', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model}</span>
          </div>
        )}

        <button
          onClick={onNewChat}
          className="no-drag"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            height: 26, padding: '0 10px', borderRadius: 6,
            border: 'none', background: '#111', color: '#fff',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <Plus size={12} />
          New
        </button>
      </div>
    </header>
  );
}
