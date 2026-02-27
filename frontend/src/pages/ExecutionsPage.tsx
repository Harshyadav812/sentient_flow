import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import {
  getAllExecutions,
  getExecutionById,
  type ExecutionData,
  type ExecutionDetailData,
} from '@/lib/api';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Minus,
  Workflow,
  LogOut,
  RefreshCw,
  History,
  ExternalLink,
} from 'lucide-react';

export function ExecutionsPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [executions, setExecutions] = useState<ExecutionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<ExecutionDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  useEffect(() => {
    loadExecutions();
  }, []);

  async function loadExecutions() {
    setIsLoading(true);
    try {
      const data = await getAllExecutions();
      setExecutions(data);
    } catch {
      toast.error('Failed to load executions');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectExecution(exec: ExecutionData) {
    if (selectedDetail?.id === exec.id) {
      setSelectedDetail(null);
      return;
    }
    setLoadingDetail(exec.id);
    try {
      const detail = await getExecutionById(exec.id);
      setSelectedDetail(detail);
    } catch {
      toast.error('Failed to load execution details');
    } finally {
      setLoadingDetail(null);
    }
  }

  const statusConfig = {
    completed: { icon: <CheckCircle2 size={14} />, label: 'Success', color: 'var(--color-success)', bg: 'rgba(74, 222, 128, 0.08)' },
    failed:    { icon: <XCircle size={14} />,      label: 'Failed',  color: 'var(--color-error)',   bg: 'rgba(248, 113, 113, 0.08)' },
    running:   { icon: <Clock size={14} />,        label: 'Running', color: 'var(--color-accent)',  bg: 'rgba(96, 165, 250, 0.08)' },
    pending:   { icon: <Minus size={14} />,        label: 'Pending', color: 'var(--color-text-muted)', bg: 'rgba(255,255,255,0.03)' },
  };

  const nodeStatusConfig: Record<string, { color: string; label: string }> = {
    success: { color: 'var(--color-success)', label: 'Success' },
    error:   { color: 'var(--color-error)',   label: 'Error' },
    skipped: { color: 'var(--color-text-muted)', label: 'Skipped' },
    running: { color: 'var(--color-accent)',  label: 'Running' },
    pending: { color: 'var(--color-text-muted)', label: 'Pending' },
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const getDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const getRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background)' }}>
      {/* Topbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          borderBottom: '1px solid var(--color-border)',
          background: 'rgba(24, 24, 27, 0.7)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))',
              borderRadius: 'var(--radius-sm)',
              padding: 6,
              display: 'flex',
              boxShadow: '0 2px 8px var(--color-accent-glow)',
            }}
          >
            <Workflow size={18} color="white" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Sentient Flow</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {user?.email}
          </span>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            style={topBtnStyle}
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/')} style={topBtnStyle} title="Back to Dashboard">
              <ArrowLeft size={14} />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={22} />
                Execution History
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
                {executions.length} execution{executions.length !== 1 ? 's' : ''} total
              </p>
            </div>
          </div>
          <button onClick={loadExecutions} style={topBtnStyle} disabled={isLoading}>
            <RefreshCw size={14} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '100px 0' }}>
            <div style={{ display: 'inline-block', border: '2px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', width: 24, height: 24, animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {/* Empty */}
        {!isLoading && executions.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 80,
              background: 'var(--color-surface)',
              color: 'var(--color-text-muted)',
              border: '1px dashed var(--color-border-hover)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <History size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 16, marginBottom: 8 }}>No executions yet</p>
            <p style={{ fontSize: 13 }}>Run a workflow to see its execution history here</p>
          </div>
        )}

        {/* Execution table */}
        {!isLoading && executions.length > 0 && (
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 140px 100px 60px',
                gap: 12,
                padding: '10px 20px',
                borderBottom: '1px solid var(--color-border)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <span>Status</span>
              <span>Workflow</span>
              <span>Started</span>
              <span>Duration</span>
              <span></span>
            </div>

            {/* Rows */}
            {executions.map((exec) => {
              const sc = statusConfig[exec.status];
              const isSelected = selectedDetail?.id === exec.id;

              return (
                <div key={exec.id}>
                  <div
                    onClick={() => handleSelectExecution(exec)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 1fr 140px 100px 60px',
                      gap: 12,
                      padding: '12px 20px',
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--color-surface-active)' : 'transparent',
                      transition: 'background 0.15s',
                      alignItems: 'center',
                      fontSize: 13,
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Status badge */}
                    <div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 10px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          color: sc.color,
                          background: sc.bg,
                        }}
                      >
                        {sc.icon}
                        {sc.label}
                      </span>
                    </div>

                    {/* Workflow name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500 }}>{exec.workflow_name || 'Unknown Workflow'}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/canvas/${exec.workflow_id}`);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 2,
                          color: 'var(--color-text-muted)',
                          opacity: 0.5,
                        }}
                        title="Open workflow"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>

                    {/* Timestamp */}
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                      {getRelativeTime(exec.started_at || exec.created_at)}
                    </div>

                    {/* Duration */}
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontFamily: 'monospace' }}>
                      {getDuration(exec.started_at, exec.finished_at)}
                    </div>

                    {/* Chevron */}
                    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 10, transition: 'transform 0.15s', transform: isSelected ? 'rotate(90deg)' : '' }}>
                      ▶
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isSelected && selectedDetail && (
                    <div
                      style={{
                        padding: '16px 20px 20px',
                        background: 'var(--color-background)',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      {/* Metadata row */}
                      <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 12 }}>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Execution ID: </span>
                          <span style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{exec.id.slice(0, 8)}…</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Started: </span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>{formatTime(exec.started_at)}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Finished: </span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>{formatTime(exec.finished_at)}</span>
                        </div>
                      </div>

                      {/* Node results header */}
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Node Results ({selectedDetail.nodes.length})
                      </div>

                      {selectedDetail.nodes.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '12px 0' }}>
                          No node data recorded for this execution.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {selectedDetail.nodes.map((node) => {
                            const ns = nodeStatusConfig[node.status] || nodeStatusConfig.pending;
                            return (
                              <details
                                key={node.id}
                                style={{
                                  background: 'var(--color-surface)',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: 'var(--radius-sm)',
                                  overflow: 'hidden',
                                }}
                              >
                                <summary
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    listStyle: 'none',
                                    fontSize: 12,
                                  }}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ns.color, flexShrink: 0 }} />
                                  <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{node.node_id}</span>
                                  <span style={{ fontSize: 11, color: ns.color, fontWeight: 500 }}>{ns.label}</span>
                                  {node.error_message && (
                                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-error)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {node.error_message}
                                    </span>
                                  )}
                                  {!node.error_message && node.finished_at && node.started_at && (
                                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                                      {getDuration(node.started_at, node.finished_at)}
                                    </span>
                                  )}
                                </summary>
                                <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 12px' }}>
                                  {/* Input */}
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Input</div>
                                    <pre style={{
                                      margin: 0,
                                      padding: '6px 8px',
                                      background: 'var(--color-background)',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: 11,
                                      fontFamily: 'monospace',
                                      color: 'var(--color-text-secondary)',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      maxHeight: 200,
                                      overflowY: 'auto',
                                    }}>
                                      {JSON.stringify(node.input_data, null, 2) || '—'}
                                    </pre>
                                  </div>
                                  {/* Output */}
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Output</div>
                                    <pre style={{
                                      margin: 0,
                                      padding: '6px 8px',
                                      background: 'var(--color-background)',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: 11,
                                      fontFamily: 'monospace',
                                      color: node.error_message ? 'var(--color-error)' : 'var(--color-text-secondary)',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      maxHeight: 200,
                                      overflowY: 'auto',
                                    }}>
                                      {node.error_message || JSON.stringify(node.output_data, null, 2) || '—'}
                                    </pre>
                                  </div>
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Loading indicator for detail */}
                  {loadingDetail === exec.id && (
                    <div style={{ padding: '16px 20px', background: 'var(--color-background)', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
                      <div style={{ display: 'inline-block', border: '2px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const topBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  transition: 'all 0.2s',
};
