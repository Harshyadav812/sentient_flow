import { useState, useEffect } from 'react';
import { getExecutions, getExecutionDetail, type ExecutionData, type ExecutionDetailData } from '@/lib/api';
import { useExecutionStore } from '@/stores/executionStore';
import { History, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Minus } from 'lucide-react';

interface ExecutionHistoryProps {
  workflowId: string | undefined;
}

export function ExecutionHistory({ workflowId }: ExecutionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [executions, setExecutions] = useState<ExecutionData[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<ExecutionDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const { nodeStatuses } = useExecutionStore();

  // Refresh list whenever the panel opens or execution statuses change
  useEffect(() => {
    if (isOpen && workflowId) {
      setLoading(true);
      getExecutions(workflowId)
        .then(setExecutions)
        .catch(() => setExecutions([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen, workflowId, Object.keys(nodeStatuses).length]);

  const handleSelectExecution = async (exec: ExecutionData) => {
    if (!workflowId) return;
    if (selectedDetail?.id === exec.id) {
      setSelectedDetail(null);
      return;
    }
    try {
      const detail = await getExecutionDetail(workflowId, exec.id);
      setSelectedDetail(detail);
    } catch {
      setSelectedDetail(null);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={12} color="var(--color-success)" />;
      case 'failed': return <XCircle size={12} color="var(--color-error)" />;
      case 'running': return <Clock size={12} color="var(--color-accent)" />;
      default: return <Minus size={12} color="var(--color-text-muted)" />;
    }
  };

  const nodeStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 size={10} color="var(--color-success)" />;
      case 'error': return <XCircle size={10} color="var(--color-error)" />;
      case 'skipped': return <Minus size={10} color="var(--color-text-muted)" />;
      default: return <Clock size={10} color="var(--color-accent)" />;
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const getDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: isOpen ? 'var(--color-surface-active)' : 'var(--color-surface-hover)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        <History size={14} />
        Runs
        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            width: 400,
            maxHeight: 480,
            overflowY: 'auto',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 200,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            Execution History
          </div>

          {/* Loading state */}
          {loading && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
              Loading…
            </div>
          )}

          {/* Empty state */}
          {!loading && executions.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
              No executions yet. Run the workflow to see history.
            </div>
          )}

          {/* Execution list */}
          {executions.map((exec) => (
            <div key={exec.id}>
              <button
                onClick={() => handleSelectExecution(exec)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  background: selectedDetail?.id === exec.id
                    ? 'var(--color-surface-active)'
                    : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  textAlign: 'left',
                }}
              >
                {statusIcon(exec.status)}
                <span style={{ fontWeight: 500 }}>
                  {exec.status === 'completed' ? 'Success' :
                   exec.status === 'failed' ? 'Failed' :
                   exec.status === 'running' ? 'Running' : 'Pending'}
                </span>
                <span style={{ color: 'var(--color-text-muted)', marginLeft: 'auto', fontSize: 11 }}>
                  {formatTime(exec.started_at || exec.created_at)}
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 11, minWidth: 40, textAlign: 'right' }}>
                  {getDuration(exec.started_at, exec.finished_at)}
                </span>
              </button>

              {/* Expanded execution detail */}
              {selectedDetail?.id === exec.id && (
                <div
                  style={{
                    padding: '8px 14px 12px',
                    background: 'var(--color-background)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Node Results
                  </div>
                  {selectedDetail.nodes.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      No node data recorded.
                    </div>
                  )}
                  {selectedDetail.nodes.map((node) => (
                    <details key={node.id} style={{ marginBottom: 2 }}>
                      <summary
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 6px',
                          cursor: 'pointer',
                          listStyle: 'none',
                          fontSize: 11,
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        {nodeStatusIcon(node.status)}
                        <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>
                          {node.node_name}
                        </span>
                        {node.error_message && (
                          <span style={{ color: 'var(--color-error)', fontSize: 10, marginLeft: 'auto' }}>
                            {node.error_message.slice(0, 40)}
                            {node.error_message.length > 40 ? '…' : ''}
                          </span>
                        )}
                      </summary>
                      <pre
                        style={{
                          padding: '4px 6px 4px 24px',
                          margin: 0,
                          fontSize: 10,
                          fontFamily: 'monospace',
                          color: 'var(--color-text-secondary)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          lineHeight: 1.4,
                        }}
                      >
                        {JSON.stringify(node.output_data || node.error_message || '—', null, 2)}
                      </pre>
                    </details>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
