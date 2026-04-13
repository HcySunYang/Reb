import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionStore } from '@/stores/connectionStore';
import { useWebSocket } from '@/hooks/useWebSocket';

export function ConnectPage() {
  const { host, port, error, status, setConnectionInfo } = useConnectionStore();
  const [token, setToken] = useState('');
  const { connect } = useWebSocket();
  const navigate = useNavigate();

  // Navigate on successful connection
  useConnectionStore.subscribe((state) => {
    if (state.status === 'connected') {
      navigate('/terminal', { replace: true });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim() || !port.trim() || !token) return;
    setConnectionInfo(host.trim(), port.trim());
    connect(host.trim(), port.trim(), token);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <form
        onSubmit={handleSubmit}
        className="w-[400px] rounded-xl border border-reb-border bg-reb-panel p-8"
      >
        <h1 className="mb-1 text-2xl font-bold text-reb-red">REB</h1>
        <p className="mb-6 text-sm text-gray-400">Remote Agent Terminal</p>

        <div className="flex gap-3 mb-4">
          <div className="flex-2">
            <label className="mb-1 block text-xs text-gray-400">Host</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setConnectionInfo(e.target.value, port)}
              placeholder="100.64.x.y"
              className="w-full rounded-md border border-reb-border bg-gray-950 px-3 py-2 text-sm text-gray-200 focus:border-reb-red focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-400">Port</label>
            <input
              type="text"
              value={port}
              onChange={(e) => setConnectionInfo(host, e.target.value)}
              className="w-full rounded-md border border-reb-border bg-gray-950 px-3 py-2 text-sm text-gray-200 focus:border-reb-red focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-gray-400">Auth Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Your passphrase"
            className="w-full rounded-md border border-reb-border bg-gray-950 px-3 py-2 text-sm text-gray-200 focus:border-reb-red focus:outline-none"
          />
        </div>

        {error && (
          <p className="mb-3 rounded bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={status === 'connecting'}
          className="w-full rounded-md bg-reb-red px-4 py-2.5 text-sm font-medium text-white hover:bg-reb-red-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'connecting' ? 'Connecting...' : 'Connect'}
        </button>
      </form>
    </div>
  );
}
