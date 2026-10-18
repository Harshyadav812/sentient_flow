import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Search, X, CornerDownLeft } from 'lucide-react';
import clsx from 'clsx';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  getPaletteNodes,
  type NodeDefinition,
} from '@/config/nodeDefinitions';
import { useWorkflowStore } from '@/stores/workflowStore';

const ALL_NODES = getPaletteNodes();

function onDragStart(e: DragEvent, def: NodeDefinition) {
  e.dataTransfer.setData('application/reactflow', def.type);
  e.dataTransfer.effectAllowed = 'move';
}

function matches(def: NodeDefinition, q: string) {
  const hay = `${def.defaultLabel} ${def.type} ${def.description} ${def.keywords ?? ''} ${CATEGORY_META[def.category].label}`;
  return q.split(/\s+/).every((word) => hay.toLowerCase().includes(word));
}

export function NodePalette({ onAdd }: { onAdd: (type: string) => void }) {
  const paletteOpen = useWorkflowStore((s) => s.paletteOpen);
  const insertFrom = useWorkflowStore((s) => s.insertFrom);
  const closePalette = useWorkflowStore((s) => s.closePalette);
  const sourceLabel = useWorkflowStore((s) => {
    const id = s.insertFrom?.nodeId ?? s.selectedNode?.id;
    return id ? s.nodes.find((n) => n.id === id)?.data.label : undefined;
  });
  const hasTrigger = useWorkflowStore((s) => s.nodes.some((n) => n.data.category === 'trigger'));

  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const [usingKeys, setUsingKeys] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // The parent remounts this component (via key) each time the palette opens, resetting search state
  useEffect(() => {
    if (!paletteOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [paletteOpen]);

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => {
    // Connecting into a trigger is impossible, and a second trigger is rarely wanted
    const pool = insertFrom || hasTrigger ? ALL_NODES.filter((d) => d.category !== 'trigger') : ALL_NODES;
    const extraTriggers = !insertFrom && hasTrigger ? ALL_NODES.filter((d) => d.category === 'trigger') : [];
    const list = [...pool, ...extraTriggers];
    return q ? list.filter((d) => matches(d, q)) : list;
  }, [q, insertFrom, hasTrigger]);

  const sections = useMemo(() => {
    const order = !insertFrom && hasTrigger
      ? [...CATEGORY_ORDER.filter((c) => c !== 'trigger'), 'trigger' as const]
      : CATEGORY_ORDER;
    return order
      .map((cat) => ({ cat, items: visible.filter((d) => d.category === cat) }))
      .filter((s) => s.items.length > 0);
  }, [visible, insertFrom, hasTrigger]);

  const flat = sections.flatMap((s) => s.items);
  const activeIndex = Math.min(active, Math.max(flat.length - 1, 0));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setUsingKeys(true);
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setUsingKeys(true);
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flat[activeIndex]) {
      e.preventDefault();
      onAdd(flat[activeIndex].type);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-surface" onKeyDown={onKeyDown}>
      <div className="shrink-0 space-y-2.5 px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 px-1">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-zinc-100">Add a node</h2>
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">
              {sourceLabel ? (
                <>Connects after <span className="text-zinc-300">{sourceLabel}</span></>
              ) : (
                'Click to add, or drag onto the canvas'
              )}
            </p>
          </div>
          <button
            onClick={closePalette}
            className="-mt-0.5 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
            title="Close (Esc)"
            aria-label="Close node panel"
          >
            <X size={15} />
          </button>
        </div>
        <div className="relative">
          <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search nodes…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActive(0);
            }}
            className="h-8 w-full rounded-lg border border-[#2e2e33] bg-background pr-3 pl-8 text-[12px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-node-trigger/50"
          />
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-2 pb-3">
        {sections.map(({ cat, items }) => (
          <div key={cat} className="mb-1">
            <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-surface px-2 pt-2.5 pb-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_META[cat].color }} />
              <h3 className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                {CATEGORY_META[cat].label}
              </h3>
            </div>
            <div className="space-y-0.5">
              {items.map((def) => {
                const i = flat.indexOf(def);
                const color = CATEGORY_META[cat].color;
                const isActive = i === activeIndex && (q !== '' || usingKeys);
                return (
                  <button
                    key={def.type}
                    data-index={i}
                    draggable
                    onDragStart={(e) => onDragStart(e, def)}
                    onClick={() => onAdd(def.type)}
                    onMouseEnter={() => { setActive(i); setUsingKeys(false); }}
                    className={clsx(
                      'group flex w-full cursor-pointer items-start gap-2.5 rounded-lg border px-2 py-2 text-left transition-colors',
                      isActive ? 'border-[#34343a] bg-white/5' : 'border-transparent hover:bg-white/3'
                    )}
                  >
                    <div
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${color}16`, color }}
                    >
                      <def.icon size={14} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[12px] leading-tight font-medium text-zinc-200">
                          {def.defaultLabel}
                        </span>
                        {isActive && <CornerDownLeft size={11} className="ml-auto shrink-0 text-zinc-500" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-500">{def.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {flat.length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-zinc-500">
            No nodes match “{search}”
          </div>
        )}
      </div>
    </div>
  );
}
