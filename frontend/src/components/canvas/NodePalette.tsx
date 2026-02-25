import type { DragEvent } from 'react';
import {
  Zap, Globe, GitBranch, Printer, Clock, Settings, Merge, Calculator,
} from 'lucide-react';

interface NodeTemplate {
  type: string;
  label: string;
  category: 'trigger' | 'action' | 'logic' | 'output';
  icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
}

const NODE_TEMPLATES: NodeTemplate[] = [
  { type: 'manual_trigger', label: 'Manual Trigger', category: 'trigger', icon: Zap },
  { type: 'http', label: 'HTTP Request', category: 'action', icon: Globe },
  { type: 'set', label: 'Set Data', category: 'output', icon: Settings },
  { type: 'if', label: 'IF', category: 'logic', icon: GitBranch },
  { type: 'switch', label: 'Switch', category: 'logic', icon: GitBranch },
  { type: 'merge', label: 'Merge', category: 'logic', icon: Merge },
  { type: 'calculate', label: 'Calculate', category: 'action', icon: Calculator },
  { type: 'delay', label: 'Delay', category: 'action', icon: Clock },
  { type: 'print', label: 'Print', category: 'output', icon: Printer },
];

const categoryColors: Record<string, string> = {
  trigger: 'var(--color-node-trigger)',
  action: 'var(--color-node-action)',
  logic: 'var(--color-node-logic)',
  output: 'var(--color-node-output)',
};

const categoryLabels: Record<string, string> = {
  trigger: 'Triggers',
  action: 'Actions',
  logic: 'Logic',
  output: 'Output',
};

function onDragStart(e: DragEvent, template: NodeTemplate) {
  e.dataTransfer.setData('application/reactflow', JSON.stringify(template));
  e.dataTransfer.effectAllowed = 'move';
}

export function NodePalette() {
  const categories = ['trigger', 'action', 'logic', 'output'] as const;

  return (
    <div
      style={{
        width: 240,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        padding: '24px 16px',
        overflowY: 'auto',
        height: '100%',
        boxShadow: '4px 0 24px rgba(0,0,0,0.2)',
        zIndex: 10,
      }}
    >
      <h3
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-text-primary)',
          margin: '0 0 20px 4px',
        }}
      >
        Nodes
      </h3>

      {categories.map((cat) => {
        const nodes = NODE_TEMPLATES.filter((n) => n.category === cat);
        if (nodes.length === 0) return null;

        return (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-muted)',
                marginBottom: 8,
                paddingLeft: 4,
              }}
            >
              {categoryLabels[cat]}
            </div>
            {nodes.map((tpl) => (
              <div
                key={tpl.type}
                draggable
                onDragStart={(e) => onDragStart(e, tpl)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'grab',
                  marginBottom: 4,
                  transition: 'all 0.15s ease',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.0)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-surface-hover)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.0)';
                }}
              >
                <div
                  style={{
                    background: `${categoryColors[cat]}15`,
                    borderRadius: 'var(--radius-sm)',
                    padding: 6,
                    display: 'flex',
                    color: categoryColors[cat],
                  }}
                >
                  <tpl.icon size={16} style={{ strokeWidth: 1.5 }} />
                </div>
                {tpl.label}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
