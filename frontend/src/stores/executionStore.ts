import { create } from 'zustand';
import { toast } from 'sonner';

interface ExecutionState {
  isRunning: boolean;
  executionId: string | null;
  runningNode: string | null;
  nodeStatuses: Record<string, 'success' | 'error' | 'skipped'>;
  results: Record<string, unknown> | null;
  error: string | null;
  execute: (payload: Record<string, unknown>, workflowId?: string) => Promise<void>;
  clear: () => void;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export const useExecutionStore = create<ExecutionState>((set) => ({
  isRunning: false,
  executionId: null,
  runningNode: null,
  nodeStatuses: {},
  results: null,
  error: null,

  execute: async (payload, workflowId) => {
    set({ isRunning: true, executionId: null, runningNode: null, nodeStatuses: {}, error: null, results: null });
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Use the saved-workflow route when we have an ID (enables execution logging)
      const url = workflowId
        ? `${API_BASE}/workflows/${workflowId}/run/stream`
        : `${API_BASE}/workflows/execute/stream`;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        // The ID-based route doesn't need a body
        ...(workflowId ? {} : { body: JSON.stringify(payload) }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Execution streaming failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.type === 'execution_start') {
              set({ executionId: data.execution_id });
            } else if (data.type === 'node_start') {
              set({ runningNode: data.node });
            } else if (data.type === 'node_end') {
              set(state => ({
                nodeStatuses: { ...state.nodeStatuses, [data.node]: data.status }
              }));
              if (data.status === 'error' && data.error) {
                toast.error(`${data.node}: ${data.error}`);
              }
            } else if (data.type === 'workflow_end') {
              set({ results: data.results });
            } else if (data.type === 'error') {
              set({ error: data.message });
              toast.error(data.message);
            }
          } catch (e) {
            console.error('Failed to parse SSE chunk', e, line);
          }
        }
      }

      set({ isRunning: false, runningNode: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      set({ error: message, isRunning: false, runningNode: null });
      toast.error(message);
    }
  },

  clear: () => set({ results: null, error: null, runningNode: null, nodeStatuses: {}, executionId: null }),
}));
