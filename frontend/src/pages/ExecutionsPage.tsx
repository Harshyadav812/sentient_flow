import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  getAllExecutions,
  getExecutionById,
  type ExecutionData,
  type ExecutionDetailData,
} from '@/lib/api';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Minus,
  RefreshCw,
  History,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import clsx from 'clsx';
import { usePreferences } from '@/stores/preferencesStore';
import { formatDateTime as formatTime, formatDuration as getDuration, formatRelative } from '@/lib/format';
import { EmptyState, ListSkeleton, PageContainer, PageHeader } from '@/components/common/PageHeader';
import { Btn } from '@/components/common/controls';

type StatusFilter = 'all' | ExecutionData['status'];

export function ExecutionsPage() {
  const navigate = useNavigate();
  const [executions, setExecutions] = useState<ExecutionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<ExecutionDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const timestampFormat = usePreferences((s) => s.timestampFormat);

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
    completed: { icon: <CheckCircle2 size={14} />, label: 'Success', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    failed: { icon: <XCircle size={14} />, label: 'Failed', color: 'text-red-400', bg: 'bg-red-400/10' },
    running: { icon: <Clock size={14} />, label: 'Running', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    pending: { icon: <Minus size={14} />, label: 'Pending', color: 'text-zinc-400', bg: 'bg-zinc-400/10' },
  };

  const nodeStatusConfig: Record<string, { color: string; label: string }> = {
    success: { color: 'text-emerald-400', label: 'Success' },
    error: { color: 'text-red-400', label: 'Error' },
    skipped: { color: 'text-zinc-500', label: 'Skipped' },
    running: { color: 'text-blue-400', label: 'Running' },
    pending: { color: 'text-zinc-500', label: 'Pending' },
  };

  const formatStarted = (exec: ExecutionData) =>
    timestampFormat === 'relative'
      ? formatRelative(exec.started_at || exec.created_at)
      : formatTime(exec.started_at || exec.created_at);

  const visible = filter === 'all' ? executions : executions.filter((e) => e.status === filter);
  const counts = executions.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <PageContainer width="max-w-5xl">
        <PageHeader
          title="Executions"
          description={isLoading ? 'Loading…' : `${executions.length} execution${executions.length !== 1 ? 's' : ''} total`}
          actions={
            <Btn variant="secondary" onClick={loadExecutions} disabled={isLoading}>
              <RefreshCw className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </Btn>
          }
        />

        {/* Loading */}
        {isLoading && <ListSkeleton rows={5} />}

        {/* Empty */}
        {!isLoading && executions.length === 0 && (
          <EmptyState
            icon={<History size={22} />}
            title="No executions yet"
            description="Run a workflow to see its execution history here."
          />
        )}

        {/* Status filter */}
        {!isLoading && executions.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
            {(['all', 'completed', 'failed', 'running'] as const).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'h-7 rounded-full border px-3 text-[12px] transition-colors',
                  filter === f
                    ? 'border-node-trigger/40 bg-node-trigger/10 text-zinc-100'
                    : 'border-[#2e2e33] text-zinc-400 hover:text-zinc-200'
                )}
              >
                {f === 'all' ? 'All' : statusConfig[f].label}
                <span className="ml-1.5 text-zinc-500 tabular-nums">
                  {f === 'all' ? executions.length : counts[f] || 0}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Execution table */}
        {!isLoading && executions.length > 0 && (
          <div className="rounded-xl border border-[#2e2e33] bg-surface overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[100px_1fr_120px_80px_32px] gap-3 px-4 py-2.5 border-b border-[#2e2e33] text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              <span>Status</span>
              <span>Workflow</span>
              <span>Started</span>
              <span>Duration</span>
              <span></span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#2e2e33]">
              {visible.length === 0 && (
                <div className="py-10 text-center text-[13px] text-zinc-500">No executions with this status</div>
              )}
              {visible.map((exec) => {
                const sc = statusConfig[exec.status];
                const isSelected = selectedDetail?.id === exec.id;

                return (
                  <div key={exec.id}>
                    <div
                      onClick={() => handleSelectExecution(exec)}
                      className={`grid grid-cols-[100px_1fr_120px_80px_32px] gap-3 px-4 py-2.5 cursor-pointer items-center text-[12px] transition-colors hover:bg-white/[0.02] ${isSelected ? 'bg-white/[0.03]' : ''}`}
                    >
                      {/* Status badge */}
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.color} ${sc.bg}`}>
                          {sc.icon}
                          {sc.label}
                        </span>
                      </div>

                      {/* Workflow name */}
                      <div className="flex items-center gap-2 font-medium text-zinc-200 text-[12px]">
                        <span className="truncate">{exec.workflow_name || 'Unknown Workflow'}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/canvas/${exec.workflow_id}`);
                          }}
                          title="Open workflow in editor"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Timestamp */}
                      <div className="text-zinc-500 text-[11px]">
                        {formatStarted(exec)}
                      </div>

                      {/* Duration */}
                      <div className="text-zinc-500 text-[11px] font-mono">
                        {getDuration(exec.started_at, exec.finished_at)}
                      </div>

                      {/* Chevron */}
                      <div className="flex justify-center text-zinc-600">
                        {isSelected ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </div>
                    </div>

                    {/* Loading detail */}
                    {loadingDetail === exec.id && (
                      <div className="p-6 border-b border-[#2e2e33] flex justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                      </div>
                    )}

                    {/* Expanded detail panel */}
                    {isSelected && selectedDetail && (
                      <div className="p-4 border-b border-[#2e2e33] bg-[#18181b]">
                        {/* Metadata row */}
                        <div className="flex flex-wrap gap-6 mb-4 text-[11px] bg-[#1f1f23] p-3 rounded-lg border border-[#2e2e33]">
                          <div>
                            <span className="text-zinc-600 block mb-0.5">Execution ID</span>
                            <span className="font-mono text-zinc-400">{exec.id}</span>
                          </div>
                          <div>
                            <span className="text-zinc-600 block mb-0.5">Started</span>
                            <span className="text-zinc-400">{formatTime(exec.started_at)}</span>
                          </div>
                          <div>
                            <span className="text-zinc-600 block mb-0.5">Finished</span>
                            <span className="text-zinc-400">{formatTime(exec.finished_at)}</span>
                          </div>
                        </div>

                        {/* Node results header */}
                        <h4 className="text-[10px] font-semibold text-zinc-500 mb-2 uppercase tracking-wider px-1">
                          Node Results ({selectedDetail.nodes.length})
                        </h4>

                        {selectedDetail.nodes.length === 0 ? (
                          <div className="text-[12px] text-zinc-500 py-4 px-1">
                            No node data recorded for this execution.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {selectedDetail.nodes.map((node) => {
                              const ns = nodeStatusConfig[node.status] || nodeStatusConfig.pending;
                              return (
                                <details
                                  key={node.id}
                                  className="group rounded-lg border border-[#2e2e33] bg-[#1f1f23] overflow-hidden [&_summary::-webkit-details-marker]:hidden"
                                >
                                  <summary className="flex items-center gap-2 p-2.5 cursor-pointer select-none border-b border-transparent group-open:border-[#2e2e33] hover:bg-white/[0.02]">
                                    <ChevronRight className="h-3 w-3 text-zinc-600 transition-transform group-open:rotate-90 shrink-0" />
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className={`h-2 w-2 rounded-full ${ns.color.replace('text-', 'bg-')} shrink-0`} />
                                      <span className="font-medium font-mono text-[12px] text-zinc-300 truncate">{node.node_name}</span>
                                      <span className={`text-[10px] font-medium ${ns.color}`}>{ns.label}</span>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0 text-[10px]">
                                      {node.error_message ? (
                                        <span className="text-red-400 max-w-[180px] truncate" title={node.error_message}>
                                          {node.error_message}
                                        </span>
                                      ) : node.finished_at && node.started_at ? (
                                        <span className="text-zinc-600 font-mono">
                                          {getDuration(node.started_at, node.finished_at)}
                                        </span>
                                      ) : null}
                                    </div>
                                  </summary>

                                  <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#18181b]">
                                    {/* Input */}
                                    <div className="flex flex-col min-w-0">
                                      <div className="text-[9px] font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">Input</div>
                                      <div className="bg-[#1f1f23] border border-[#2e2e33] rounded-md p-2.5 overflow-hidden h-full">
                                        <pre className="text-[11px] font-mono text-zinc-500 whitespace-pre-wrap word-break h-full max-h-48 overflow-y-auto custom-scrollbar">
                                          {JSON.stringify(node.input_data, null, 2) || '{}'}
                                        </pre>
                                      </div>
                                    </div>

                                    {/* Output */}
                                    <div className="flex flex-col min-w-0">
                                      <div className="text-[9px] font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">Output</div>
                                      <div className={`bg-[#1f1f23] border border-[#2e2e33] rounded-md p-2.5 overflow-hidden h-full ${node.error_message ? 'border-red-900/30' : ''}`}>
                                        <pre className={`text-[11px] font-mono whitespace-pre-wrap word-break h-full max-h-48 overflow-y-auto custom-scrollbar ${node.error_message ? 'text-red-400' : 'text-zinc-500'}`}>
                                          {node.error_message || JSON.stringify(node.output_data, null, 2) || '{}'}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                </details>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </PageContainer>
  );
}
