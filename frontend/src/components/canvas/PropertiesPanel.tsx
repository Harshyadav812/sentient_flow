import { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import clsx from 'clsx';
import {
  X, Trash2, Plus, Code, List, Settings2, SlidersHorizontal, ChevronDown, ChevronRight, Database,
  Settings, CheckCircle2, XCircle,
} from 'lucide-react';
import { useWorkflowStore, type NodeData } from '@/stores/workflowStore';
import { useExecutionStore } from '@/stores/executionStore';
import {
  CATEGORY_META,
  NODE_DEFINITIONS,
  isPropertyVisible,
  validateNodeParams,
  type NodeProperty,
  type ValidationError,
} from '@/config/nodeDefinitions';
import { getCredentialsCached, type CredentialData } from '@/lib/api';
import { Switch } from '@/components/common/controls';
import type { Node } from '@xyflow/react';

type PanelTab = 'params' | 'settings';
type TextField = HTMLInputElement | HTMLTextAreaElement;

const TEXT_TYPES = new Set(['string', 'code', 'json', 'json-array']);

/** Build a `$` reference the backend resolver understands, quoting names with spaces. */
function refFor(name: string, path: string[] = []) {
  const root = /^[A-Za-z_][\w-]*$/.test(name) ? `$${name}` : `$'${name}'`;
  return (
    root +
    path.map((k) => (/^\d+$/.test(k) ? `[${k}]` : /^[\w-]+$/.test(k) ? `.${k}` : `['${k}']`)).join('')
  );
}

function ancestorsOf(nodeId: string, nodes: Node<NodeData>[], edges: { source: string; target: string }[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const order: Node<NodeData>[] = [];
  const seen = new Set<string>([nodeId]);
  let frontier = [nodeId];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of edges) {
        if (e.target === id && !seen.has(e.source)) {
          seen.add(e.source);
          next.push(e.source);
          const n = byId.get(e.source);
          if (n) order.push(n);
        }
      }
    }
    frontier = next;
  }
  return order;
}

export function PropertiesPanel() {
  const settingsNodeId = useWorkflowStore((s) => s.settingsNodeId);
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === s.settingsNodeId));
  const close = () => useWorkflowStore.getState().setSettingsNodeId(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!settingsNodeId || !node) return null;

  return (
    <>
      <div className="absolute inset-0 z-90 bg-black/20" onClick={close} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 right-0 z-100 flex h-full w-full max-w-110 animate-in flex-col border-l border-[#2e2e33] bg-surface shadow-[-8px_0_30px_rgba(0,0,0,0.4)] duration-200 slide-in-from-right"
      >
        <NodeSettings key={node.id} node={node} onClose={close} />
      </div>
    </>
  );
}

function NodeSettings({ node, onClose }: { node: Node<NodeData>; onClose: () => void }) {
  const { updateNodeData, removeNode, renameNode } = useWorkflowStore.getState();
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const nodeResults = useExecutionStore((s) => s.nodeResults);

  const data = node.data;
  const def = NODE_DEFINITIONS[data.type];
  const params = useMemo(() => (data.parameters || {}) as Record<string, unknown>, [data.parameters]);
  const color = CATEGORY_META[data.category]?.color ?? '#71717a';
  const Icon = def?.icon ?? Settings;

  const [activeTab, setActiveTab] = useState<PanelTab>('params');
  const [isRawMode, setIsRawMode] = useState(false);
  const [rawText, setRawText] = useState('');
  const [rawError, setRawError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(data.label);
  const [credentials, setCredentials] = useState<CredentialData[]>([]);
  const [showData, setShowData] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const focused = useRef<{ name: string; el: TextField } | null>(null);

  useEffect(() => {
    let active = true;
    getCredentialsCached()
      .then((c) => active && setCredentials(c))
      .catch(() => active && setCredentials([]));
    return () => {
      active = false;
    };
  }, []);

  const validationErrors = useMemo(() => validateNodeParams(data.type, params), [data.type, params]);
  const errorsByField = useMemo(() => {
    const m = new Map<string, ValidationError>();
    for (const e of validationErrors) m.set(e.field, e);
    return m;
  }, [validationErrors]);

  const ancestors = useMemo(() => ancestorsOf(node.id, nodes, edges), [node.id, nodes, edges]);
  const schemaProps = (def?.properties ?? []).filter((p) => isPropertyVisible(data.type, p, params));
  const mappedKeys = new Set((def?.properties ?? []).map((p) => p.name));
  const extraParamKeys = Object.keys(params).filter((k) => !mappedKeys.has(k));
  const lastRun = nodeResults[data.label];

  const setParams = (next: Record<string, unknown>) => updateNodeData(node.id, { parameters: next });
  const handleParamChange = (key: string, value: unknown) => setParams({ ...params, [key]: value });

  const handleJsonBlur = (key: string, value: string) => {
    if (value.trim() === '') return;
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'string') handleParamChange(key, parsed);
    } catch {
      // Not JSON (e.g. a $ reference); keep as a string
    }
  };

  const commitName = () => {
    const next = nameDraft.trim();
    if (!next || next === data.label) {
      setNameDraft(data.label);
      return;
    }
    renameNode(node.id, next);
    const finalName = useWorkflowStore.getState().nodes.find((n) => n.id === node.id)?.data.label ?? next;
    setNameDraft(finalName);
    if (finalName !== next) toast.info(`Renamed to "${finalName}" because that name is taken`);
  };

  const insertRef = (ref: string) => {
    const f = focused.current;
    if (!f || !f.el.isConnected) {
      navigator.clipboard?.writeText(ref).then(
        () => toast.success(`Copied ${ref}`, { description: 'Click into a field first to insert it directly.' }),
        () => toast.info(ref)
      );
      return;
    }
    const el = f.el;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + ref + el.value.slice(end);
    handleParamChange(f.name, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ref.length, start + ref.length);
    });
  };

  const trackFocus = (name: string) => (e: React.FocusEvent<TextField>) => {
    focused.current = { name, el: e.currentTarget };
  };

  const toggleRaw = () => {
    if (!isRawMode) setRawText(JSON.stringify(params, null, 2));
    setRawError(null);
    setIsRawMode(!isRawMode);
  };

  const addCustomParam = () => {
    const key = newKey.trim();
    if (!key) return;
    let value: unknown = newValue;
    try {
      if (newValue.trim() !== '') value = JSON.parse(newValue);
    } catch {
      value = newValue;
    }
    handleParamChange(key, value);
    setNewKey('');
    setNewValue('');
  };

  const tabBtn = (tab: PanelTab) =>
    clsx(
      '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12px] font-medium transition-colors',
      activeTab === tab ? 'border-node-trigger text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
    );

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-[#2e2e33] px-4 py-3.5">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}1c`, color }}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                e.preventDefault();
                setNameDraft(data.label);
                requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
              }
            }}
            aria-label="Node name"
            title="Rename node. References like $'Name' in other nodes update automatically."
            className="-ml-1.5 w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[14px] font-semibold text-zinc-100 outline-none transition-colors hover:border-[#2e2e33] focus:border-node-trigger/50 focus:bg-background"
          />
          {def && <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{def.description}</p>}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-surface-hover hover:text-zinc-300"
          title="Close (Esc)"
          aria-label="Close settings"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2e2e33] px-4">
        <button onClick={() => setActiveTab('params')} className={tabBtn('params')}>
          <SlidersHorizontal size={13} />
          Parameters
          {validationErrors.length > 0 && (
            <span className="ml-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
              {validationErrors.length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('settings')} className={tabBtn('settings')}>
          <Settings2 size={13} />
          Settings
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'params' && (
          <div className="space-y-4 p-4">
            {/* Data picker */}
            {ancestors.length > 0 && (def?.properties.some((p) => TEXT_TYPES.has(p.type)) ?? true) && (
              <div className="rounded-xl border border-[#2e2e33] bg-background/60">
                <button
                  onClick={() => setShowData(!showData)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium text-zinc-300"
                >
                  <Database size={12} className="text-zinc-500" />
                  Data from earlier nodes
                  <span className="ml-auto text-zinc-600">{showData ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
                </button>
                {showData && (
                  <div className="space-y-2 border-t border-[#2e2e33] px-3 py-2.5">
                    <p className="text-[10px] leading-snug text-zinc-500">
                      Click a field below, then a chip to insert a reference. Run the workflow to see each node's fields.
                    </p>
                    {ancestors.slice(0, 8).map((a) => (
                      <DataChips key={a.id} name={a.data.label} result={nodeResults[a.data.label]?.result} onInsert={insertRef} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                {isRawMode ? 'JSON editor' : 'Parameters'}
              </span>
              <button
                onClick={toggleRaw}
                className="flex items-center gap-1 text-[11px] text-node-trigger transition-colors hover:text-accent-hover"
              >
                {isRawMode ? <List size={12} /> : <Code size={12} />}
                {isRawMode ? 'Form view' : 'Edit as JSON'}
              </button>
            </div>

            {isRawMode ? (
              <div>
                <textarea
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    try {
                      const parsed = JSON.parse(e.target.value);
                      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        setParams(parsed);
                        setRawError(null);
                      } else setRawError('Parameters must be a JSON object');
                    } catch {
                      setRawError('Invalid JSON, changes are not applied yet');
                    }
                  }}
                  rows={14}
                  spellCheck={false}
                  className={clsx('n8n-input resize-y font-mono text-[12px] leading-relaxed', rawError && 'n8n-input-error')}
                />
                {rawError && <p className="mt-1 text-[11px] text-red-400">{rawError}</p>}
              </div>
            ) : (
              <>
                {schemaProps.length === 0 && extraParamKeys.length === 0 && (
                  <p className="rounded-lg border border-dashed border-[#2e2e33] px-3 py-4 text-center text-[12px] text-zinc-500">
                    This node has nothing to configure.
                  </p>
                )}

                {schemaProps.map((prop) => (
                  <PropertyField
                    key={prop.name}
                    prop={prop}
                    value={params[prop.name] ?? prop.default}
                    error={errorsByField.get(prop.name)}
                    credentials={credentials}
                    onChange={(v) => handleParamChange(prop.name, v)}
                    onJsonBlur={(v) => handleJsonBlur(prop.name, v)}
                    onFocus={trackFocus(prop.name)}
                  />
                ))}

                <div className="border-t border-[#2e2e33] pt-3">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-300"
                  >
                    {showAdvanced || extraParamKeys.length > 0 ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Custom parameters
                    {extraParamKeys.length > 0 && <span className="text-zinc-600">({extraParamKeys.length})</span>}
                  </button>
                  {(showAdvanced || extraParamKeys.length > 0) && (
                    <div className="mt-2.5 space-y-2">
                      {extraParamKeys.map((k) => {
                        const v = params[k];
                        return (
                          <div key={k} className="flex items-center gap-2">
                            <div className="flex-1 truncate text-[12px] text-zinc-400" title={k}>{k}</div>
                            <input
                              value={typeof v === 'string' ? v : JSON.stringify(v)}
                              onChange={(e) => handleParamChange(k, e.target.value)}
                              onBlur={(e) => handleJsonBlur(k, e.target.value)}
                              onFocus={trackFocus(k)}
                              className="n8n-input flex-2 px-2! py-1.5! text-[12px]!"
                            />
                            <button
                              onClick={() => {
                                const next = { ...params };
                                delete next[k];
                                setParams(next);
                              }}
                              className="p-1 text-zinc-600 transition-colors hover:text-red-400"
                              aria-label={`Remove ${k}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex gap-2">
                        <input
                          placeholder="Key"
                          value={newKey}
                          onChange={(e) => setNewKey(e.target.value)}
                          className="n8n-input flex-1 px-2! py-1.5! text-[12px]!"
                        />
                        <input
                          placeholder="Value"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addCustomParam()}
                          className="n8n-input flex-1 px-2! py-1.5! text-[12px]!"
                        />
                        <button
                          onClick={addCustomParam}
                          disabled={!newKey.trim()}
                          className="flex items-center justify-center rounded-md bg-node-trigger p-1.5 text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-[#2e2e33] disabled:text-zinc-600"
                          aria-label="Add parameter"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {lastRun && <LastRunOutput result={lastRun} />}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4 p-4">
            <div>
              <label className="n8n-label">Type</label>
              <div className="n8n-input cursor-default bg-surface-hover! text-zinc-400!">
                {def?.defaultLabel ?? data.type} <span className="text-zinc-600">· {data.type}</span>
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-[#2e2e33] p-3">
              <div>
                <div className="text-[12px] font-medium text-zinc-200">Disable node</div>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  A disabled node is skipped and passes its input straight through.
                </p>
              </div>
              <Switch
                label="Disable node"
                checked={!!data.disabled}
                onChange={(v) => updateNodeData(node.id, { disabled: v })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[#2e2e33] px-4 py-3">
        <button
          onClick={() => {
            removeNode(node.id);
            onClose();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/15 bg-red-500/8 px-3 py-2 text-[12px] font-medium text-red-400 transition-colors hover:bg-red-500/15"
        >
          <Trash2 size={13} />
          Delete node
        </button>
      </div>
    </>
  );
}

function PropertyField({
  prop,
  value,
  error,
  credentials,
  onChange,
  onJsonBlur,
  onFocus,
}: {
  prop: NodeProperty;
  value: unknown;
  error?: ValidationError;
  credentials: CredentialData[];
  onChange: (v: unknown) => void;
  onJsonBlur: (v: string) => void;
  onFocus: (e: React.FocusEvent<TextField>) => void;
}) {
  const cls = clsx('n8n-input', error && 'n8n-input-error');
  const id = `prop-${prop.name}`;

  return (
    <div>
      <label className="n8n-label" htmlFor={id}>
        {prop.displayName}
        {prop.required && <span className="ml-0.5 text-red-400">*</span>}
      </label>

      {prop.type === 'options' && (
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} className={cls}>
          {prop.options?.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.name}
            </option>
          ))}
        </select>
      )}

      {prop.type === 'credential' && (
        <>
          <select id={id} value={String(value || '')} onChange={(e) => onChange(e.target.value)} className={cls}>
            <option value="">{credentials.length ? 'Select a credential' : 'No credentials saved yet'}</option>
            {credentials.map((cred) => (
              <option key={cred.id} value={cred.id}>
                {cred.name} ({cred.type})
              </option>
            ))}
          </select>
          {credentials.length === 0 && (
            <a href="/credentials" target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-node-trigger hover:underline">
              Add a credential →
            </a>
          )}
        </>
      )}

      {prop.type === 'boolean' && (
        <div className="mt-1">
          <Switch label={prop.displayName} checked={!!value} onChange={onChange} />
        </div>
      )}

      {prop.type === 'number' && (
        <input
          id={id}
          type="number"
          value={value as number}
          min={prop.min}
          max={prop.max}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder={prop.placeholder}
          className={cls}
        />
      )}

      {prop.type === 'string' && prop.multiline && (
        <textarea
          id={id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={prop.placeholder}
          rows={3}
          className={clsx(cls, 'field-sizing-content max-h-60 min-h-18 resize-y leading-relaxed')}
        />
      )}

      {prop.type === 'string' && !prop.multiline && (
        <input
          id={id}
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={prop.placeholder}
          spellCheck={false}
          className={cls}
        />
      )}

      {prop.type === 'code' && (
        <textarea
          id={id}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={prop.placeholder}
          rows={4}
          spellCheck={false}
          className={clsx(cls, 'resize-y font-mono text-[12px] leading-relaxed')}
        />
      )}

      {(prop.type === 'json' || prop.type === 'json-array') && (
        <textarea
          id={id}
          value={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onJsonBlur(e.target.value)}
          onFocus={onFocus}
          placeholder={prop.placeholder}
          rows={Math.min(10, Math.max(3, JSON.stringify(value ?? '', null, 2).split('\n').length))}
          spellCheck={false}
          className={clsx(cls, 'min-h-15 resize-y font-mono text-[12px] leading-relaxed')}
        />
      )}

      {error ? (
        <p className="mt-1 text-[11px] font-medium text-red-400">{error.message}</p>
      ) : (
        prop.description && <p className="mt-1 text-[11px] leading-snug text-zinc-500">{prop.description}</p>
      )}
    </div>
  );
}

function DataChips({ name, result, onInsert }: { name: string; result: unknown; onInsert: (ref: string) => void }) {
  const chip = (label: string, ref: string, primary = false) => (
    <button
      key={ref}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onInsert(ref)}
      title={`Insert ${ref}`}
      className={clsx(
        'max-w-full truncate rounded-md border px-1.5 py-0.5 font-mono text-[11px] transition-colors',
        primary
          ? 'border-zinc-600 bg-white/6 font-medium text-zinc-100 hover:border-zinc-400 hover:bg-white/10'
          : 'border-[#34343a] bg-surface text-zinc-400 hover:border-zinc-500 hover:text-zinc-100'
      )}
    >
      {label}
    </button>
  );

  const keys =
    result && typeof result === 'object' && !Array.isArray(result)
      ? Object.keys(result as Record<string, unknown>).slice(0, 10)
      : [];

  return (
    <div className="flex flex-wrap items-center gap-1">
      {chip(name, refFor(name), true)}
      {keys.map((k) => chip(`.${k}`, refFor(name, [k])))}
      {Array.isArray(result) && result.length > 0 && chip('[0]', refFor(name, ['0']))}
    </div>
  );
}

function LastRunOutput({ result }: { result: { status: string; result?: unknown; error?: string } }) {
  const [open, setOpen] = useState(true);
  const ok = result.status === 'success';
  const text =
    result.status === 'error'
      ? result.error ?? 'Failed'
      : result.status === 'skipped'
        ? 'This node was skipped in the last run (its branch was not taken).'
        : typeof result.result === 'string'
          ? result.result
          : JSON.stringify(result.result, null, 2);

  return (
    <div className="rounded-xl border border-[#2e2e33] bg-background/60">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium text-zinc-300">
        {ok ? <CheckCircle2 size={12} className="text-emerald-400" /> : result.status === 'error' ? <XCircle size={12} className="text-red-400" /> : <ChevronRight size={12} className="text-zinc-500" />}
        Output from last run
        <span className="ml-auto text-zinc-600">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
      </button>
      {open && (
        <pre
          className={clsx(
            'max-h-60 overflow-auto border-t border-[#2e2e33] px-3 py-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap',
            result.status === 'error' ? 'text-red-300' : 'text-zinc-400'
          )}
        >
          {text}
        </pre>
      )}
    </div>
  );
}
