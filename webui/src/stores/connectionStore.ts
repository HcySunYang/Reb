import { create } from 'zustand';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface ConnectionState {
  status: ConnectionStatus;
  host: string;
  port: string;
  error: string | null;

  setConnectionInfo: (host: string, port: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const savedHost = localStorage.getItem('reb-host') || 'localhost';
const savedPort = localStorage.getItem('reb-port') || '7680';

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  host: savedHost,
  port: savedPort,
  error: null,

  setConnectionInfo: (host, port) => {
    localStorage.setItem('reb-host', host);
    localStorage.setItem('reb-port', port);
    set({ host, port });
  },

  setStatus: (status) => set({ status, error: status === 'connected' ? null : undefined }),

  setError: (error) => set({ error, status: 'disconnected' }),

  reset: () => set({ status: 'disconnected', error: null }),
}));
