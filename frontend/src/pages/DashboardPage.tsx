import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useWorkflowStore } from '@/stores/workflowStore';
import { usePreferences } from '@/stores/preferencesStore';
import {
  getWorkflows,
  createWorkflow,
  deleteWorkflow,
  type WorkflowData,
} from '@/lib/api';
import { formatDateTime, formatRelative, parseUTC } from '@/lib/format';
import { Plus, Trash2, Upload } from 'lucide-react';
import { ImportWorkflowModal } from '@/components/ImportWorkflowModal';
import { EmptyState, ListSkeleton, PageContainer, PageHeader, SearchBox } from '@/components/common/PageHeader';
import { Btn } from '@/components/common/controls';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

const nodeCount = (wf: WorkflowData) => {
  const nodes = (wf.data as { nodes?: unknown[] } | null)?.nodes;
  return Array.isArray(nodes) ? nodes.length : 0;
};

const lastEdited = (wf: WorkflowData) => wf.updated_at || wf.created_at;

export function DashboardPage() {
  const { deserializeFromPayload, setWorkflowId } = useWorkflowStore();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<WorkflowData | null>(null);
  const confirmBeforeDelete = usePreferences((s) => s.confirmBeforeDelete);
  const timestampFormat = usePreferences((s) => s.timestampFormat);

  useEffect(() => {
    loadWorkflows();
  }, []);

  async function loadWorkflows() {
    try {
      const data = await getWorkflows();
      setWorkflows(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    setIsCreating(true);
    try {
      const wf = await createWorkflow({
        name: 'New Workflow',
        data: {
          name: 'New Workflow',
          nodes: [
            {
              id: 'node_1',
              name: 'Start',
              type: 'manual_trigger',
              position: [200, 250],
              parameters: {},
            },
          ],
          connections: {},
        },
      });
      navigate(`/canvas/${wf.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create workflow');
      setIsCreating(false);
    }
  }

  async function handleDelete(wf: WorkflowData) {
    try {
      await deleteWorkflow(wf.id);
      setWorkflows((wfs) => wfs.filter((w) => w.id !== wf.id));
      toast.success(`Deleted "${wf.name}"`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete workflow');
      throw err;
    }
  }

  function handleOpen(wf: WorkflowData) {
    setWorkflowId(wf.id);
    if (wf.data) {
      deserializeFromPayload(wf.data);
    }
    navigate(`/canvas/${wf.id}`);
  }

  const filteredWorkflows = workflows
    .filter((wf) => wf.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => (parseUTC(lastEdited(b))?.getTime() ?? 0) - (parseUTC(lastEdited(a))?.getTime() ?? 0));

  const formatTs = timestampFormat === 'relative' ? formatRelative : formatDateTime;

  return (
    <PageContainer>
      <PageHeader
        title="Workflows"
        description={
          isLoading ? 'Loading…' : `${workflows.length} workflow${workflows.length !== 1 ? 's' : ''}`
        }
        actions={
          <>
            <Btn variant="secondary" onClick={() => setShowImport(true)}>
              <Upload /> Import
            </Btn>
            <Btn onClick={handleCreate} loading={isCreating}>
              {!isCreating && <Plus />} New workflow
            </Btn>
          </>
        }
      />

      {isLoading ? (
        <ListSkeleton />
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={<img src="/favicon.svg" alt="" className="h-6 w-6 opacity-70 grayscale" />}
          title="No workflows yet"
          description="Create your first workflow to start automating tasks, or import one from a JSON file."
          action={
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={() => setShowImport(true)}>
                <Upload /> Import
              </Btn>
              <Btn onClick={handleCreate} loading={isCreating}>
                {!isCreating && <Plus />} Create workflow
              </Btn>
            </div>
          }
        />
      ) : (
        <>
          <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder="Search workflows…" />

          <div className="overflow-hidden rounded-xl border border-[#2e2e33] bg-surface">
            <div className="hidden grid-cols-[1fr_90px_130px_40px] gap-4 border-b border-[#2e2e33] px-4 py-2.5 text-[11px] font-medium tracking-wide text-zinc-500 uppercase sm:grid">
              <span>Name</span>
              <span>Nodes</span>
              <span>Last edited</span>
              <span />
            </div>

            <ul className="divide-y divide-[#2e2e33]">
              {filteredWorkflows.map((wf) => (
                <li key={wf.id}>
                  <div
                    role="link"
                    tabIndex={0}
                    onClick={() => handleOpen(wf)}
                    onKeyDown={(e) => e.key === 'Enter' && handleOpen(wf)}
                    className="group grid cursor-pointer grid-cols-[1fr_40px] items-center gap-4 px-4 py-3 transition-colors outline-none hover:bg-white/2 focus-visible:bg-white/4 sm:grid-cols-[1fr_90px_130px_40px]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-node-trigger/10">
                        <img src="/favicon.svg" alt="" className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-zinc-200 group-hover:text-white">
                          {wf.name}
                        </div>
                        <div className="truncate text-[11px] text-zinc-500">
                          {wf.description || (
                            <span className="sm:hidden">
                              {nodeCount(wf)} nodes · {formatTs(lastEdited(wf))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="hidden text-[12px] text-zinc-500 tabular-nums sm:block">
                      {nodeCount(wf)} node{nodeCount(wf) !== 1 ? 's' : ''}
                    </div>

                    <div className="hidden text-[12px] text-zinc-500 sm:block" title={formatDateTime(lastEdited(wf))}>
                      {formatTs(lastEdited(wf))}
                    </div>

                    <div className="flex justify-end">
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirmBeforeDelete) setPendingDelete(wf);
                          else handleDelete(wf).catch(() => {});
                        }}
                        title="Delete workflow"
                        aria-label={`Delete ${wf.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}

              {filteredWorkflows.length === 0 && searchQuery && (
                <li className="py-10 text-center text-[13px] text-zinc-500">No workflows match "{searchQuery}"</li>
              )}
            </ul>
          </div>
        </>
      )}

      <ImportWorkflowModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={loadWorkflows}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete "${pendingDelete?.name}"?`}
        description="The workflow and its execution history will be permanently deleted."
        onConfirm={() => handleDelete(pendingDelete!)}
      />
    </PageContainer>
  );
}
