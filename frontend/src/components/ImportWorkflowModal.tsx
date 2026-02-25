import { useState } from 'react';
import { createWorkflow } from '@/lib/api';
import { FileCode, X, Upload } from 'lucide-react';

interface ImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportWorkflowModal({ onClose, onSuccess }: ImportModalProps) {
  const [jsonStr, setJsonStr] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    setError('');
    setIsLoading(true);
    try {
      const parsed = JSON.parse(jsonStr);
      
      // Basic validation
      let name = parsed.name || 'Imported Workflow';
      let data = parsed.data || parsed; // fallback if they just pasted the graph

      await createWorkflow({
        name,
        data,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid JSON format');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCode size={18} color="var(--color-accent)" />
            <h2 style={{ margin: 0, fontSize: 18 }}>Import Workflow</h2>
          </div>
          <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
        </div>
        
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Paste the raw JSON representation of your workflow below.
          </p>
          
          <textarea
            value={jsonStr}
            onChange={(e) => setJsonStr(e.target.value)}
            placeholder='{ "name": "...", "data": { ... } }'
            rows={12}
            style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
          />

          {error && <div style={{ color: 'var(--color-error)', fontSize: 13 }}>{error}</div>}

          <button 
            onClick={handleImport} 
            disabled={isLoading || !jsonStr.trim()} 
            style={{ ...primaryBtnStyle, opacity: isLoading || !jsonStr.trim() ? 0.6 : 1 }}
          >
            <Upload size={16} /> Import Workflow
          </button>
        </div>
      </div>
    </div>
  );
}

// Styles (shared with CredentialsModal)
const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
};

const modalStyle: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: '24px', width: 520, maxWidth: '90%', boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden'
};

const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '20px 24px', borderBottom: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.02)'
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px', background: 'var(--color-background)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 13, outline: 'none'
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px',
  background: 'var(--color-text-primary)', color: 'var(--color-background)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600, cursor: 'pointer'
};
