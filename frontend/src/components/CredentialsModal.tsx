import { useState, useEffect } from 'react';
import { getCredentials, createCredential, deleteCredential } from '@/lib/api';
import { Key, Trash2, Plus, X } from 'lucide-react';

interface CredentialsModalProps {
  onClose: () => void;
}

interface Credential {
  id: string;
  name: string;
  type: string;
}

export function CredentialsModal({ onClose }: CredentialsModalProps) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [name, setName] = useState('');
  const [type, setType] = useState('api_key');
  const [dataStr, setDataStr] = useState('{\n  "token": "your_token_here"\n}');

  const fetchCredentials = async () => {
    try {
      const data = await getCredentials();
      setCredentials(data);
    } catch (err) {
      console.error('Failed to fetch credentials:', err);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      setIsLoading(true);
      const parsedData = JSON.parse(dataStr);
      await createCredential({ name, type, data: parsedData });
      setName('');
      setDataStr('{\n  "token": "your_token_here"\n}');
      await fetchCredentials();
    } catch (err) {
      alert('Failed to create credential. Make sure data is valid JSON.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCredential(id);
      await fetchCredentials();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={18} color="var(--color-accent)" />
            <h2 style={{ margin: 0, fontSize: 18 }}>Credentials Manager</h2>
          </div>
          <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
        </div>
        
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, maxHeight: '60vh', overflowY: 'auto' }}>
          <div>
            <h3 style={sectionTitleStyle}>Your Credentials</h3>
            {credentials.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No credentials found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {credentials.map(c => (
                  <div key={c.id} style={credCardStyle}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{c.type}</div>
                    </div>
                    <button onClick={() => handleDelete(c.id)} style={dangerBtnStyle}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 24 }}>
            <h3 style={sectionTitleStyle}>Add New Credential</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Credential Name (e.g. OpenAI Key)"
                style={inputStyle}
              />
              <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
                <option value="api_key">API Key</option>
                <option value="oauth2">OAuth2</option>
                <option value="basic_auth">Basic Auth</option>
              </select>
              <textarea
                value={dataStr}
                onChange={e => setDataStr(e.target.value)}
                rows={4}
                style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
              />
              <button onClick={handleCreate} disabled={isLoading || !name.trim()} style={primaryBtnStyle}>
                <Plus size={16} /> Add Credential
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Styles
const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
};

const modalStyle: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: '24px', width: 480, maxWidth: '90%', boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden'
};

const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '20px 24px', borderBottom: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.02)'
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em'
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'var(--color-background)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: 14, outline: 'none'
};

const credCardStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 16px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)'
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px',
  background: 'var(--color-text-primary)', color: 'var(--color-background)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600, cursor: 'pointer'
};

const dangerBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: 4
};
