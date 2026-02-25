import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeData } from '@/stores/workflowStore';
import {
  Zap, Globe, GitBranch, Printer, Clock, Settings, Merge,
} from 'lucide-react';

const categoryColors: Record<string, string> = {
  trigger: 'var(--color-node-trigger)',
  action: 'var(--color-node-action)',
  logic: 'var(--color-node-logic)',
  output: 'var(--color-node-output)',
};

const typeIcons: Record<string, React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>> = {
  manual_trigger: Zap,
  http: Globe,
  if: GitBranch,
  condition: GitBranch,
  switch: GitBranch,
  print: Printer,
  delay: Clock,
  set: Settings,
  calculate: Settings,
  merge: Merge,
};

export function WorkflowNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const color = categoryColors[nodeData.category] || 'var(--color-accent)';
  const Icon = typeIcons[nodeData.type] || Settings;
  const isLogicNode = nodeData.category === 'logic' && nodeData.type !== 'merge';

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${selected ? color : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '0',
        minWidth: 220,
        boxShadow: selected ? `0 0 0 1px ${color}, 0 8px 24px rgba(0,0,0,0.6)` : '0 4px 12px rgba(0,0,0,0.3)',
        opacity: nodeData.disabled ? 0.5 : 1,
        transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
      }}
    >
      {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="input-0"
          style={{
            background: 'var(--color-text-secondary)',
            width: 8,
            height: 16,
            borderRadius: '4px',
            border: 'none',
            left: -4,
          }}
        />

      {/* Node header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <div
          style={{
            background: `${color}15`,
            borderRadius: 'var(--radius-md)',
            padding: 8,
            display: 'flex',
            color: color,
          }}
        >
          <Icon size={20} />
        </div>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              lineHeight: 1.3,
            }}
          >
            {nodeData.label}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-muted)',
              marginTop: 2,
              fontWeight: 500,
            }}
          >
            {nodeData.type}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: nodeData.disabled ? 'var(--color-text-muted)' : 'var(--color-success)' }} />
        {nodeData.disabled ? 'Disabled' : 'Ready'}
      </div>

      {/* Output handles */}
      {isLogicNode ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="output-0"
            style={{
              background: 'var(--color-success)',
              width: 8,
              height: 16,
              borderRadius: '4px',
              border: 'none',
              top: '35%',
              right: -4,
            }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="output-1"
            style={{
              background: 'var(--color-error)',
              width: 8,
              height: 16,
              borderRadius: '4px',
              border: 'none',
              top: '65%',
              right: -4,
            }}
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="output-0"
          style={{
            background: 'var(--color-text-secondary)',
            width: 8,
            height: 16,
            borderRadius: '4px',
            border: 'none',
            right: -4,
          }}
        />
      )}
    </div>
  );
}
