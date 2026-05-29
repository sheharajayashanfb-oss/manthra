import { useEffect, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';

export type PermissionDecision = 'allow' | 'always' | 'project' | 'deny';

interface PermissionRequest {
  id: string;
  tool: string;
  action: string;
  details: string;
}

interface Props {
  request: PermissionRequest;
  onRespond: (id: string, decision: PermissionDecision) => void;
}

const OPTIONS: { label: string; sublabel: string; decision: PermissionDecision; key: string }[] = [
  { label: 'Allow once',                decision: 'allow',   sublabel: 'just this call',     key: '1' },
  { label: 'Always allow (session)',    decision: 'always',  sublabel: 'until you close app', key: '2' },
  { label: 'Allow for this project',   decision: 'project', sublabel: 'saved in project',    key: '3' },
  { label: 'Deny',                     decision: 'deny',    sublabel: 'block this call',      key: '4' },
];

export default function PermissionDialog({ request, onRespond }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, [request.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onRespond(request.id, 'deny'); return; }
      if (e.key === 'Enter')  { onRespond(request.id, 'allow'); return; }
      const opt = OPTIONS.find((o) => o.key === e.key);
      if (opt) onRespond(request.id, opt.decision);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [request.id, onRespond]);

  const detail = request.details.length > 120
    ? request.details.slice(0, 117) + '…'
    : request.details;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 9998, backdropFilter: 'blur(2px)',
        }}
        onClick={() => onRespond(request.id, 'deny')}
      />

      {/* Dialog card */}
      <div
        ref={containerRef}
        tabIndex={-1}
        style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999,
          width: 460, maxWidth: 'calc(100vw - 32px)',
          background: '#fff',
          border: '1.5px solid #e5e7eb',
          borderRadius: 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          outline: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px 10px',
          borderBottom: '1px solid #f3f4f6',
          background: '#fafafa',
        }}>
          <ShieldAlert size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Permission required</span>
          <span style={{
            marginLeft: 'auto',
            fontSize: 10, color: '#aaa',
            background: '#f3f4f6', borderRadius: 4, padding: '2px 6px',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {request.tool}
          </span>
        </div>

        {/* Action + detail */}
        <div style={{ padding: '10px 16px 12px' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#374151', margin: 0, marginBottom: 4 }}>
            {request.action}
          </p>
          {detail && (
            <p style={{
              fontSize: 11, color: '#9ca3af', margin: 0,
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              background: '#f9fafb', borderRadius: 6, padding: '6px 8px',
              border: '1px solid #f3f4f6',
            }}>
              {detail}
            </p>
          )}
        </div>

        {/* Options */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, padding: '0 16px 14px' }}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.decision}
              onClick={() => onRespond(request.id, opt.decision)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                border: opt.decision === 'deny'
                  ? '1px solid #fee2e2'
                  : '1px solid #e5e7eb',
                background: opt.decision === 'deny' ? '#fff5f5' : '#fff',
                transition: 'background 0.1s, border-color 0.1s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  opt.decision === 'deny' ? '#fee2e2' : '#f0fdf4';
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  opt.decision === 'deny' ? '#fca5a5' : '#86efac';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  opt.decision === 'deny' ? '#fff5f5' : '#fff';
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  opt.decision === 'deny' ? '#fee2e2' : '#e5e7eb';
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  fontSize: 9, fontFamily: 'JetBrains Mono, monospace',
                  color: opt.decision === 'deny' ? '#ef4444' : '#6b7280',
                  background: opt.decision === 'deny' ? '#fee2e2' : '#f3f4f6',
                  borderRadius: 3, padding: '1px 4px', lineHeight: 1.4,
                }}>
                  {opt.key}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 500,
                  color: opt.decision === 'deny' ? '#ef4444' : '#111',
                }}>
                  {opt.label}
                </span>
              </span>
              <span style={{ fontSize: 10, color: '#9ca3af', paddingLeft: 18 }}>
                {opt.sublabel}
              </span>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '6px 16px 10px',
          borderTop: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, color: '#d1d5db' }}>Enter = allow once · Esc = deny</span>
          <span style={{ fontSize: 10, color: '#d1d5db' }}>keys 1–4 for quick select</span>
        </div>
      </div>
    </>
  );
}
