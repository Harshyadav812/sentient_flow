import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useWorkflowStore, type NodeData } from '@/stores/workflowStore';
import { useExecutionStore } from '@/stores/executionStore';
import { validateWorkflow } from '@/lib/validateWorkflow';
import { updateWorkflow } from '@/lib/api';
import {
  CATEGORY_META,
  NODE_DEFINITIONS,
  getNodeSummary,
  getOutputLabels,
} from '@/config/nodeDefinitions';
import { toast } from 'sonner';
import {
  Settings, Loader2, RotateCcw, Trash2, Check, X as XIcon, Plus, Power, Minus,
} from 'lucide-react';
import clsx from 'clsx';

const BOX_W = 100;
const OUTPUT_SPACING = 28;

const outputColor = (label: string) =>
  label === 'true' ? '#10b981' : label === 'false' ? '#ef4444' : '#71717a';

function WorkflowNodeImpl({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const params = (nodeData.parameters || {}) as Record<string, unknown>;

  const isRunning = useExecutionStore((s) => s.runningNode === nodeData.label);
  const status = useExecutionStore((s) => s.nodeStatuses[nodeData.label]);
  const canRetry = useExecutionStore(
    (s) => s.overallStatus === 'failed' && !!s.executionId && s.nodeStatuses[nodeData.label] === 'error'
  );
  const isGlobalRunning = useExecutionStore((s) => s.isRunning);

  // Primitive selector so the node only re-renders when its own outgoing edges change
  const connectedHandles = useWorkflowStore((s) =>
    s.edges.filter((e) => e.source === id).map((e) => e.sourceHandle ?? 'output-0').join('|')
  );
  const isInsertSource = useWorkflowStore((s) => s.insertFrom?.nodeId === id);
  const insertHandle = useWorkflowStore((s) => (s.insertFrom?.nodeId === id ? s.insertFrom.handle : null));

  const [isStartingRun, setIsStartingRun] = useState(false);

  const def = NODE_DEFINITIONS[nodeData.type];
  const Icon = def?.icon ?? Settings;
  const color = CATEGORY_META[nodeData.category]?.color ?? '#6366f1';
  const isTrigger = nodeData.category === 'trigger';
  const outputs = getOutputLabels(nodeData.type, params);
  const boxH = Math.max(80, outputs.length * OUTPUT_SPACING + 24);
  const summary = nodeData.disabled ? 'Disabled' : getNodeSummary(nodeData.type, params);
  const connected = new Set(connectedHandles.split('|'));

  const store = () => useWorkflowStore.getState();

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { executionId, resume } = useExecutionStore.getState();
    if (!executionId) return;
    const { nodes, edges, workflowId, workflowName, serializeToPayload } = store();
    const result = validateWorkflow(nodes, edges);
    if (!result.valid) {
      toast.error(`Validation failed: ${result.errors.length} error(s)`);
      return;
    }
    setIsStartingRun(true);
    try {
      if (workflowId) await updateWorkflow(workflowId, { name: workflowName, data: serializeToPayload() });
      await resume(executionId);
    } catch {
      toast.error('Failed to save before resuming');
    } finally {
      setIsStartingRun(false);
    }
  };

  const toolbarBtn =
    'flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/8 hover:text-zinc-100';

  return (
    <div className="group relative flex flex-col items-center" style={{ width: BOX_W }}>
      {/* Hover toolbar */}
      <div
        className={clsx(
          'nodrag absolute -top-9 z-10 flex items-center gap-0.5 rounded-lg border border-[#2e2e33] bg-surface p-0.5 shadow-lg transition-opacity duration-150',
          selected ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'
        )}
      >
        {canRetry && (
          <button
            onClick={handleRetry}
            disabled={isGlobalRunning || isStartingRun}
            className={clsx(toolbarBtn, 'text-red-400 hover:text-red-300 disabled:opacity-50')}
            title="Retry from this node"
          >
            <RotateCcw size={13} className={isStartingRun ? 'animate-spin' : ''} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); store().setSettingsNodeId(id); }}
          className={toolbarBtn}
          title="Open settings (double-click)"
        >
          <Settings size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); store().updateNodeData(id, { disabled: !nodeData.disabled }); }}
          className={clsx(toolbarBtn, nodeData.disabled && 'text-amber-400')}
          title={nodeData.disabled ? 'Enable node' : 'Disable node (it will be skipped)'}
        >
          <Power size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); store().removeNode(id); }}
          className={clsx(toolbarBtn, 'hover:bg-red-500/15 hover:text-red-400')}
          title="Delete node (Del)"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Node box */}
      <div
        className={clsx(
          'relative flex items-center justify-center bg-surface transition-[border-color,box-shadow,opacity] duration-200',
          isTrigger ? 'rounded-l-[30px] rounded-r-[14px]' : 'rounded-[14px]',
          nodeData.disabled && 'opacity-45 grayscale',
          isRunning && 'n8n-node-running',
          !isRunning && status === 'success' && 'border-2 border-emerald-500',
          !isRunning && status === 'error' && 'border-2 border-red-500',
          !isRunning && status === 'skipped' && 'border-[1.5px] border-dashed border-zinc-600',
          !isRunning && !status && (selected
            ? 'border-[1.5px] border-node-trigger/70 shadow-[0_0_0_4px_rgba(255,109,90,0.12)]'
            : 'border-[1.5px] border-[#34343a] group-hover:border-zinc-500')
        )}
        style={{ width: BOX_W, height: boxH }}
      >
        {isRunning && (
          <div
            className={clsx(
              'n8n-running-border absolute -inset-0.75 z-[-1]',
              isTrigger ? 'rounded-l-[33px] rounded-r-[17px]' : 'rounded-[17px]'
            )}
          />
        )}

        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}1c` }}
        >
          {isRunning ? (
            <Loader2 size={22} className="animate-spin" style={{ color }} />
          ) : (
            <Icon size={22} style={{ color }} strokeWidth={1.8} />
          )}
        </div>

        {!isRunning && status && status !== 'skipped' && (
          <div
            className={clsx(
              'absolute -right-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background',
              status === 'success' ? 'bg-emerald-500' : 'bg-red-500'
            )}
          >
            {status === 'success' ? (
              <Check size={11} className="text-white" strokeWidth={3} />
            ) : (
              <XIcon size={11} className="text-white" strokeWidth={3} />
            )}
          </div>
        )}
        {!isRunning && status === 'skipped' && (
          <div className="absolute -right-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-zinc-600" title="Skipped">
            <Minus size={11} className="text-white" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Label + summary */}
      <div className="pointer-events-none mt-2 w-40 text-center">
        <div className="truncate text-[13px] leading-tight font-medium text-zinc-200">{nodeData.label}</div>
        {summary && (
          <div className={clsx('mt-0.5 truncate text-[11px]', nodeData.disabled ? 'text-amber-500/80' : 'text-zinc-500')}>
            {summary}
          </div>
        )}
      </div>

      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          id="input-0"
          className="h-3! w-3! rounded-full! border-2! border-background! bg-zinc-500! transition-colors hover:bg-node-trigger!"
          style={{ top: boxH / 2 }}
        />
      )}

      {outputs.map((label, i) => {
        const handleId = `output-${i}`;
        const top = (boxH / (outputs.length + 1)) * (i + 1);
        const isOpen = !connected.has(handleId);
        const isActiveInsert = isInsertSource && insertHandle === handleId;
        return (
          <div key={handleId}>
            <Handle
              type="source"
              position={Position.Right}
              id={handleId}
              className="h-3! w-3! rounded-full! border-2! border-background! transition-transform hover:scale-125"
              style={{ top, backgroundColor: outputColor(label) }}
            />
            {(label || isOpen) && (
              <div
                className={clsx(
                  'nodrag absolute flex h-5 items-center',
                  !isOpen && 'pointer-events-none',
                  isOpen && !isActiveInsert && 'opacity-70 transition-opacity group-hover:opacity-100'
                )}
                style={{ left: BOX_W + 6, top: top - 10 }}
              >
                {isOpen && <div className="h-px w-2 bg-zinc-600" />}
                {label && (
                  <span
                    className="max-w-16 truncate rounded bg-background px-1 text-[10px] leading-4 font-medium"
                    style={{ color: outputColor(label) }}
                    title={label}
                  >
                    {label}
                  </span>
                )}
                {isOpen && (
                  <>
                    <div className="h-px w-3 bg-zinc-600" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store().openPalette({ nodeId: id, handle: handleId });
                      }}
                      className={clsx(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border bg-surface transition-colors',
                        isActiveInsert
                          ? 'border-node-trigger text-node-trigger'
                          : 'border-zinc-600 text-zinc-400 hover:border-node-trigger hover:text-node-trigger'
                      )}
                      title={label ? `Add a node to the "${label}" output` : 'Add the next node'}
                      aria-label="Add node"
                    >
                      <Plus size={12} strokeWidth={2.5} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeImpl);
