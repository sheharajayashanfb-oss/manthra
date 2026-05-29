import { useEffect, useRef } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface ConfirmRequest {
  id: string;
  action: string;
  details: string;
}

interface Props {
  request: ConfirmRequest;
  onRespond: (id: string, confirmed: boolean) => void;
}

export default function ConfirmDialog({ request, onRespond }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, [request.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'y' || e.key === 'Y') { onRespond(request.id, true); return; }
      if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') { onRespond(request.id, false); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [request.id, onRespond]);

  const detail = request.details.length > 200
    ? request.details.slice(0, 197) + '…'
    : request.details;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 9998, backdropFilter: 'blur(2px)',
        }}
        onClick={() => onRespond(request.id, false)}
      />

      {/* Dialog card */}
      <div
        ref={containerRef}
        tabIndex={-1}
        style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999,
          width: 440, maxWidth: 'calc(100vw - 32px)',
          background: '#fff',
          border: '1.5px solid #fde68a',
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
          borderBottom: '1px solid #fef3c7',
          background: '#fffbeb',
        }}>
          <AlertTriangle size={15} style={{ color: '#d97706', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>Confirmation required</span>
        </div>

        {/* Action + detail */}
        <div style={{ padding: '12px 16px 14px' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: 0, marginBottom: detail ? 8 : 0 }}>
            {request.action}
          </p>
          {detail && (
            <p style={{
              fontSize: 11, color: '#6b7280', margin: 0,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: '#f9fafb', borderRadius: 6, padding: '6px 8px',
              border: '1px solid #f3f4f6',
            }}>
              {detail}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
          <button
            onClick={() => onRespond(request.id, true)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 0', borderRadius: 8, cursor: 'pointer',
              border: '1px solid #86efac', background: '#f0fdf4',
              fontSize: 13, fontWeight: 500, color: '#15803d',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#dcfce7'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4'; }}
          >
            <Check size={13} /> Confirm
          </button>
          <button
            onClick={() => onRespond(request.id, false)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 0', borderRadius: 8, cursor: 'pointer',
              border: '1px solid #fca5a5', background: '#fff5f5',
              fontSize: 13, fontWeight: 500, color: '#dc2626',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff5f5'; }}
          >
            <X size={13} /> Cancel
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: '6px 16px 10px', borderTop: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: 10, color: '#d1d5db' }}>Enter / Y = confirm · Esc / N = cancel</span>
        </div>
      </div>
    </>
  );
}
