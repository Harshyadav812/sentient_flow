import { create } from 'zustand';

interface ExecutionState {
  isRunning: boolean;
  runningNode: string | null;
  results: Record<string, unknown> | null;
  error: string | null;
  execute: (payload: Record<string, unknown>) => Promise<void>;
  clear: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  isRunning: false,
  runningNode: null,
  results: null,
  error: null,

  execute: async (payload) => {
    set({ isRunning: true, runningNode: null, error: null, results: null });
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`http://localhost:8000/workflows/execute/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok || !res.body) {
         throw new Error('Execution streaming failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const results: Record<string, unknown> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'node_start') {
               set({ runningNode: data.node });
            } else if (data.type === 'node_end') {
               results[data.node] = data.status === 'success' ? data.result : { error: data.error };
               set({ results: { ...results } }); // Spread to trigger re-render
            } else if (data.type === 'error') {
               set({ error: data.message });
            }
          } catch (e) {
            console.error('Failed to parse SSE chunk', e, line);
          }
        }
      }

      set({ isRunning: false, runningNode: null, results });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      set({ error: message, isRunning: false, runningNode: null });
    }
  },

  clear: () => set({ results: null, error: null, runningNode: null }),
}));
