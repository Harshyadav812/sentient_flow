import { useCallback, useRef, useEffect, useMemo, useState, type DragEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { WorkflowNode } from '@/components/canvas/WorkflowNode';
import { DeletableEdge } from '@/components/canvas/DeletableEdge';
import { NodePalette } from '@/components/canvas/NodePalette';
import { PropertiesPanel } from '@/components/canvas/PropertiesPanel';
import { ExecutionPanel } from '@/components/canvas/ExecutionPanel';
import { useWorkflowStore, type InsertTarget, type NodeData } from '@/stores/workflowStore';
import type { Node } from '@xyflow/react';
import { useExecutionStore } from '@/stores/executionStore';
import { usePreferences } from '@/stores/preferencesStore';
import { updateWorkflow, getWorkflow } from '@/lib/api';
import { CATEGORY_META, NODE_DEFINITIONS, getOutputLabels } from '@/config/nodeDefinitions';
import { validateWorkflow, type WorkflowError } from '@/lib/validateWorkflow';
import {
  Play,
  Loader2,
  X,
  AlertTriangle,
  ChevronLeft,
  Check,
  CloudOff,
  Plus,
  PanelLeftOpen,
  PanelLeftClose,
  PanelBottomOpen,
  PanelBottomClose,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

const nodeTypes: NodeTypes = { workflow: WorkflowNode };
const edgeTypes: EdgeTypes = { deletable: DeletableEdge };

const NODE_W = 100;
const NODE_H = 80;
const STEP_X = 220;
const AUTOSAVE_MS = 1200;
const SETTINGS_PANEL_W = 440;

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

function wouldCreateCycle(edges: Edge[], source: string, target: string) {
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length) {
    const current = stack.pop()!;
    if (current === source) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const e of edges) if (e.source === current) stack.push(e.target);
  }
  return false;
}

function freeSpot(nodes: Node<NodeData>[], pos: { x: number; y: number }) {
  const p = { ...pos };
  for (let tries = 0; tries < 20; tries++) {
    const clash = nodes.some((n) => Math.abs(n.position.x - p.x) < NODE_W && Math.abs(n.position.y - p.y) < NODE_H + 30);
    if (!clash) break;
    p.y += 130;
  }
  return p;
}

export function CanvasPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rf, setRf] = useState<ReactFlowInstance<Node<NodeData>, Edge> | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const showMinimap = usePreferences((s) => s.showMinimap);
  const showGrid = usePreferences((s) => s.showGrid);
  const snapToGrid = usePreferences((s) => s.snapToGrid);
  const [isExecutionPanelOpen, setIsExecutionPanelOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<WorkflowError[]>([]);
  const [isStartingRun, setIsStartingRun] = useState(false);

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const workflowName = useWorkflowStore((s) => s.workflowName);
  const saveStatus = useWorkflowStore((s) => s.saveStatus);
  const savedSnapshot = useWorkflowStore((s) => s.savedSnapshot);
  const settingsNodeId = useWorkflowStore((s) => s.settingsNodeId);
  const paletteOpen = useWorkflowStore((s) => s.paletteOpen);
  const paletteSession = useWorkflowStore((s) => s.paletteSession);
  const {
    setWorkflowName, saveWorkflow, onNodesChange, onEdgesChange, onConnect,
    selectNode, setSettingsNodeId, serializeToPayload, openPalette, closePalette,
    createNode, layoutNodes,
  } = useWorkflowStore.getState();

  const isRunning = useExecutionStore((s) => s.isRunning);
  const overallStatus = useExecutionStore((s) => s.overallStatus);
  const nodeStatuses = useExecutionStore((s) => s.nodeStatuses);
  const execute = useExecutionStore((s) => s.execute);

  const isLoaded = loadedId === id;
  const snapshot = useMemo(
    () => (isLoaded ? JSON.stringify(serializeToPayload()) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, edges, workflowName, isLoaded]
  );
  const isDirty = isLoaded && snapshot !== savedSnapshot;

  // Auto-opening the output panel shrinks the canvas, so re-fit once its animation ends.
  // Not cancelled when the run finishes: short runs end before the animation does.
  const panelOpenRef = useRef(isExecutionPanelOpen);
  panelOpenRef.current = isExecutionPanelOpen;
  useEffect(() => {
    if (!isRunning || panelOpenRef.current) return;
    setIsExecutionPanelOpen(true);
    setTimeout(() => rf?.fitView({ maxZoom: 1, padding: 0.2, duration: 300 }), 340);
  }, [isRunning, rf]);

  // Load workflow. The store is reset first so stale nodes from another workflow can never be autosaved here.
  useEffect(() => {
    if (!id) return;
    let active = true;
    useExecutionStore.getState().clear();
    useWorkflowStore.getState().clear();
    useWorkflowStore.getState().setWorkflowId(id);
    if (usePreferences.getState().openPaletteByDefault) openPalette();
    else closePalette();

    getWorkflow(id)
      .then((wf) => {
        if (!active) return;
        useWorkflowStore.getState().deserializeFromPayload({ ...(wf.data ?? {}), name: wf.name });
        setLoadedId(id);
      })
      .catch(() => {
        if (!active) return;
        toast.error('Workflow not found');
        navigate('/', { replace: true });
      });
    return () => {
      active = false;
    };
  }, [id, navigate, openPalette, closePalette]);

  // Autosave shortly after the last change; a failed save is only retried once something changes
  const lastAttempt = useRef('');
  useEffect(() => {
    if (!isDirty || saveStatus === 'saving') return;
    if (saveStatus === 'error' && lastAttempt.current === snapshot) return;
    const t = setTimeout(() => {
      lastAttempt.current = snapshot;
      saveWorkflow({ silent: true });
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [isDirty, snapshot, saveStatus, saveWorkflow]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  // Validation errors are only meaningful for the graph they were computed on
  useEffect(() => {
    setValidationErrors([]);
  }, [nodes.length, edges.length]);

  const centerOnNode = useCallback(
    (nodeId: string) => {
      const n = useWorkflowStore.getState().nodes.find((x) => x.id === nodeId);
      if (!n || !rf) return;
      rf.setCenter(n.position.x + NODE_W / 2, n.position.y + NODE_H / 2, { zoom: Math.max(rf.getZoom(), 0.8), duration: 300 });
    },
    [rf]
  );

  // Pan so a node is on screen, keeping clear of the settings panel when it will cover the right side
  const ensureVisible = useCallback(
    (pos: { x: number; y: number }, rightInset = 0) => {
      const el = wrapperRef.current;
      if (!rf || !el) return;
      const r = el.getBoundingClientRect();
      const inset = r.width - rightInset > 320 ? rightInset : 0;
      const tl = rf.screenToFlowPosition({ x: r.left, y: r.top });
      const br = rf.screenToFlowPosition({ x: r.right - inset, y: r.bottom });
      const margin = 40 / rf.getZoom();
      const inside =
        pos.x > tl.x + margin && pos.x + NODE_W < br.x - margin && pos.y > tl.y + margin && pos.y + NODE_H < br.y - margin;
      if (inside) return;
      const shift = inset / 2 / rf.getZoom();
      rf.setCenter(pos.x + NODE_W / 2 + shift, pos.y + NODE_H / 2, { zoom: rf.getZoom(), duration: 300 });
    },
    [rf]
  );

  const openSettingsIfConfigurable = useCallback((nodeId: string, type: string) => {
    if ((NODE_DEFINITIONS[type]?.properties.length ?? 0) > 0) setSettingsNodeId(nodeId);
  }, [setSettingsNodeId]);

  const handleAdd = useCallback(
    (type: string) => {
      const state = useWorkflowStore.getState();
      const { nodes: current, edges: currentEdges, insertFrom, selectedNode } = state;
      const isTrigger = NODE_DEFINITIONS[type]?.category === 'trigger';

      let from: InsertTarget | null = insertFrom;
      const selected = selectedNode && current.find((n) => n.id === selectedNode.id);
      if (!from && selected && !isTrigger) {
        const outs = getOutputLabels(selected.data.type, selected.data.parameters);
        const used = new Set(currentEdges.filter((e) => e.source === selected.id).map((e) => e.sourceHandle));
        const free = outs.findIndex((_, i) => !used.has(`output-${i}`));
        from = { nodeId: selected.id, handle: `output-${free === -1 ? 0 : free}` };
      }

      let pos: { x: number; y: number };
      const source = from && current.find((n) => n.id === from!.nodeId);
      if (source && from && !isTrigger) {
        const outs = getOutputLabels(source.data.type, source.data.parameters);
        const idx = Number(from.handle.replace('output-', '')) || 0;
        pos = { x: source.position.x + STEP_X, y: source.position.y + (idx - (outs.length - 1) / 2) * 130 };
      } else {
        const r = wrapperRef.current?.getBoundingClientRect();
        const center = rf && r ? rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 200, y: 200 };
        pos = { x: center.x - NODE_W / 2, y: center.y - NODE_H / 2 };
      }
      pos = freeSpot(current, pos);

      const newId = createNode(type, pos, isTrigger ? null : from);
      if (insertFrom) closePalette();
      const configurable = (NODE_DEFINITIONS[type]?.properties.length ?? 0) > 0;
      ensureVisible(pos, configurable ? SETTINGS_PANEL_W : 0);
      openSettingsIfConfigurable(newId, type);
    },
    [rf, createNode, closePalette, ensureVisible, openSettingsIfConfigurable]
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/reactflow');
      if (!type || !NODE_DEFINITIONS[type] || !rf) return;
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newId = createNode(type, { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 });
      openSettingsIfConfigurable(newId, type);
    },
    [rf, createNode, openSettingsIfConfigurable]
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const isValidConnection = useCallback(
    (c: Connection | Edge) =>
      !!c.source && !!c.target && c.source !== c.target &&
      !wouldCreateCycle(useWorkflowStore.getState().edges, c.source, c.target),
    []
  );

  const handleRun = useCallback(async () => {
    const { nodes: current, edges: currentEdges, workflowName: name } = useWorkflowStore.getState();
    const result = validateWorkflow(current, currentEdges);
    if (!result.valid) {
      setValidationErrors(result.errors);
      toast.error(`Fix ${result.errors.length} ${result.errors.length === 1 ? 'problem' : 'problems'} before running`);
      return;
    }
    setValidationErrors([]);
    useExecutionStore.getState().clear();
    setIsStartingRun(true);
    try {
      const payload = serializeToPayload();
      if (id) {
        try {
          await updateWorkflow(id, { name, data: payload });
          useWorkflowStore.setState({ savedSnapshot: JSON.stringify(payload) });
        } catch {
          toast.error('Failed to save before running');
          return;
        }
      }
      await execute(payload, id);
    } finally {
      setIsStartingRun(false);
    }
  }, [id, execute, serializeToPayload]);

  const tidyUp = useCallback(() => {
    layoutNodes();
    requestAnimationFrame(() => rf?.fitView({ maxZoom: 1, padding: 0.2, duration: 300 }));
  }, [layoutNodes, rf]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveWorkflow();
      } else if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (!useExecutionStore.getState().isRunning) handleRun();
      } else if (
        e.key === 'Tab' && !mod && !e.shiftKey && !isTyping(e.target) &&
        (e.target === document.body || wrapperRef.current?.contains(e.target as globalThis.Node)) &&
        !useWorkflowStore.getState().settingsNodeId
      ) {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveWorkflow, handleRun, openPalette]);

  const errorNodeIds = useMemo(() => new Set(validationErrors.map((e) => e.nodeId)), [validationErrors]);

  const displayNodes = useMemo(
    () =>
      errorNodeIds.size === 0
        ? nodes
        : nodes.map((n) =>
            errorNodeIds.has(n.id)
              ? { ...n, style: { outline: '2px solid var(--color-error)', outlineOffset: 6, borderRadius: '1rem' } }
              : n
          ),
    [nodes, errorNodeIds]
  );

  const displayEdges = useMemo(() => {
    if (Object.keys(nodeStatuses).length === 0) return edges;
    const labelById = new Map(nodes.map((n) => [n.id, n.data.label]));
    return edges.map((e) => {
      const src = nodeStatuses[labelById.get(e.source) ?? ''];
      const dst = nodeStatuses[labelById.get(e.target) ?? ''];
      const traversed = src === 'success' && !!dst && dst !== 'skipped';
      return traversed ? { ...e, style: { stroke: '#10b981', strokeWidth: 2 } } : e;
    });
  }, [edges, nodes, nodeStatuses]);

  const busy = isRunning || isStartingRun;
  const onlyTriggers = nodes.length > 0 && nodes.every((n) => n.data.category === 'trigger');

  const headerBtn = (active = false) =>
    clsx(
      'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition-colors',
      active ? 'bg-node-trigger/10 text-node-trigger hover:bg-node-trigger/15' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
    );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="z-50 flex h-13 shrink-0 items-center gap-2 border-b border-[#2e2e33] bg-surface px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <button
            onClick={() => navigate('/')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
            title="Back to workflows"
          >
            <ChevronLeft size={18} />
          </button>

          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            aria-label="Workflow name"
            className="field-sizing-content max-w-70 min-w-20 truncate rounded-md border-none bg-transparent px-1.5 py-1 text-[14px] font-semibold text-zinc-100 outline-none transition-colors hover:bg-white/4 focus:bg-white/6"
            spellCheck={false}
          />

          <div className="hidden sm:block">
            <SaveIndicator status={saveStatus} dirty={isDirty} onRetry={() => saveWorkflow()} />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={tidyUp} className={headerBtn()} title="Tidy up: arrange nodes automatically" disabled={nodes.length < 2}>
            <Wand2 size={14} />
            <span className="hidden md:inline">Tidy up</span>
          </button>
          <button
            onClick={() => (paletteOpen ? closePalette() : openPalette())}
            className={headerBtn(paletteOpen)}
            title="Add nodes (Tab)"
          >
            {paletteOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            <span className="hidden sm:inline">Nodes</span>
          </button>
          <button
            onClick={() => setIsExecutionPanelOpen((p) => !p)}
            className={headerBtn(isExecutionPanelOpen)}
            title="Show run output"
          >
            {isExecutionPanelOpen ? <PanelBottomClose size={15} /> : <PanelBottomOpen size={15} />}
            <span className="hidden sm:inline">Output</span>
            {!isRunning && overallStatus === 'success' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            {!isRunning && overallStatus === 'failed' && <span className="h-1.5 w-1.5 rounded-full bg-red-400" />}
            {isRunning && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-node-trigger" />}
          </button>

          <div className="mx-1 h-6 w-px bg-[#2e2e33]" />

          <button
            onClick={handleRun}
            disabled={busy || !isLoaded}
            title="Run workflow (Ctrl+Enter)"
            className={clsx(
              'flex h-8 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition-all',
              busy
                ? 'cursor-not-allowed bg-surface-hover text-zinc-500'
                : 'bg-node-trigger text-white shadow-[0_0_12px_rgba(255,109,90,0.2)] hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(255,109,90,0.35)]'
            )}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} className="fill-current" />}
            {isRunning ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="flex shrink-0 items-start gap-2.5 border-b border-red-500/20 bg-red-500/8 px-4 py-2 text-[12px] text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="font-medium text-red-400">
              {validationErrors.length} {validationErrors.length === 1 ? 'problem' : 'problems'}:
            </span>
            {validationErrors.slice(0, 4).map((err, i) =>
              err.nodeId ? (
                <button
                  key={i}
                  onClick={() => {
                    centerOnNode(err.nodeId);
                    setSettingsNodeId(err.nodeId);
                  }}
                  className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-left hover:bg-red-500/20"
                  title="Open this node"
                >
                  {err.message}
                </button>
              ) : (
                <span key={i}>{err.message}</span>
              )
            )}
            {validationErrors.length > 4 && <span className="text-red-400/70">+{validationErrors.length - 4} more</span>}
          </div>
          <button onClick={() => setValidationErrors([])} className="p-0.5 text-red-400/60 hover:text-red-300" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div
          className={clsx(
            'h-full shrink-0 overflow-hidden border-r border-[#2e2e33] bg-surface transition-[width] duration-200',
            paletteOpen ? 'w-72' : 'w-0 border-r-0'
          )}
        >
          <div className="h-full w-72">
            <NodePalette key={paletteSession} onAdd={handleAdd} />
          </div>
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1" ref={wrapperRef}>
            {!isLoaded ? (
              <div className="flex h-full items-center justify-center text-zinc-500">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : (
              <ReactFlow
                key={id}
                nodes={displayNodes}
                edges={displayEdges}
                onInit={setRf}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                isValidConnection={isValidConnection}
                onNodeClick={(_, node) => selectNode(node)}
                onNodeDoubleClick={(_, node) => setSettingsNodeId(node.id)}
                onPaneClick={() => selectNode(null)}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'deletable', style: { stroke: '#4a4a52', strokeWidth: 1.5 } }}
                connectionRadius={28}
                deleteKeyCode={['Backspace', 'Delete']}
                snapToGrid={snapToGrid}
                snapGrid={[24, 24]}
                fitView
                fitViewOptions={{ maxZoom: 1, padding: 0.25 }}
                minZoom={0.2}
                proOptions={{ hideAttribution: true }}
                className="n8n-canvas"
                colorMode="dark"
              >
                {showGrid && <Background gap={24} size={1.5} color="#2c2c31" />}
                <Controls className="n8n-controls" position="bottom-left" showInteractive={false} />
                {showMinimap && (
                  <MiniMap
                    nodeColor={(n) => CATEGORY_META[(n.data as NodeData).category]?.color ?? '#3a3a40'}
                    nodeStrokeWidth={0}
                    maskColor="rgba(24,24,27,0.8)"
                    className="n8n-minimap max-sm:hidden!"
                    style={{ width: 168, height: 110 }}
                    position="bottom-right"
                    pannable
                    zoomable
                  />
                )}
              </ReactFlow>
            )}

            {isLoaded && nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => openPalette()}
                  className="pointer-events-auto flex flex-col items-center gap-3 rounded-2xl border border-dashed border-surface-active px-10 py-8 text-zinc-400 transition-colors hover:border-node-trigger/60 hover:text-zinc-200"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-node-trigger/10 text-node-trigger">
                    <Plus size={22} />
                  </span>
                  <span className="text-[13px] font-medium">Add a trigger to start</span>
                  <span className="text-[11px] text-zinc-500">Every workflow begins with a trigger</span>
                </button>
              </div>
            )}

            {isLoaded && onlyTriggers && edges.length === 0 && !settingsNodeId && (
              <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
                <div className="flex items-center gap-2 rounded-full border border-[#2e2e33] bg-surface/95 px-4 py-2 text-[12px] text-zinc-400 shadow-lg backdrop-blur">
                  <span className="flex h-4 w-4 items-center justify-center rounded border border-zinc-500 text-zinc-300">
                    <Plus size={10} strokeWidth={3} />
                  </span>
                  Click the <span className="text-zinc-200">+</span> next to your trigger, or press
                  <kbd className="rounded border border-surface-active bg-background px-1.5 py-px text-[10px] text-zinc-300">Tab</kbd>
                  to add the first step
                </div>
              </div>
            )}

          </div>

          <ExecutionPanel isOpen={isExecutionPanelOpen} onToggle={() => setIsExecutionPanelOpen((p) => !p)} />
          {settingsNodeId && <PropertiesPanel />}
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({
  status,
  dirty,
  onRetry,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
  dirty: boolean;
  onRetry: () => void;
}) {
  if (status === 'saving') {
    return (
      <span className="ml-1 flex shrink-0 items-center gap-1 text-[11px] text-zinc-500">
        <Loader2 size={12} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (status === 'error' && dirty) {
    return (
      <button onClick={onRetry} className="ml-1 flex shrink-0 items-center gap-1 text-[11px] text-red-400 hover:text-red-300">
        <CloudOff size={12} /> Not saved, retry
      </button>
    );
  }
  if (dirty) {
    return <span className="ml-1 shrink-0 text-[11px] text-zinc-500">Unsaved changes</span>;
  }
  return (
    <span className="ml-1 flex shrink-0 items-center gap-1 text-[11px] text-zinc-500">
      <Check size={12} className="text-emerald-500" /> Saved
    </span>
  );
}
