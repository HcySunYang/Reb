import { useCallback } from 'react';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSessionStore } from '@/stores/sessionStore';
import {
  BINARY_OUTPUT_TAG,
  bytesToUuid,
  buildInputFrame,
  type ServerMessage,
} from '@/lib/protocol';

let globalWs: WebSocket | null = null;

export function getWs(): WebSocket | null {
  return globalWs;
}

export function useWebSocket() {
  const connect = useCallback((host: string, port: string, token: string) => {
    const { setStatus, setError } = useConnectionStore.getState();
    setStatus('connecting');

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${host}:${port}`;

    try {
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      globalWs = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          handleBinaryFrame(new Uint8Array(event.data));
          return;
        }
        const msg: ServerMessage = JSON.parse(event.data as string);
        handleMessage(msg);
      };

      ws.onclose = () => {
        globalWs = null;
        setStatus('disconnected');
      };

      ws.onerror = () => {
        globalWs = null;
        setError('Connection failed. Check host and port.');
      };
    } catch {
      setError('Invalid connection URL.');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (globalWs) {
      globalWs.close();
      globalWs = null;
    }
    useSessionStore.getState().clearAll();
    useConnectionStore.getState().reset();
  }, []);

  const send = useCallback((data: string | ArrayBuffer) => {
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.send(data);
    }
  }, []);

  const sendInput = useCallback((sessionId: string, data: string) => {
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.send(buildInputFrame(sessionId, data));
    }
  }, []);

  const createSession = useCallback((cols: number, rows: number, cli?: string) => {
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({ type: 'create_session', cols, rows, cli }));
    }
  }, []);

  const killSession = useCallback((sessionId: string) => {
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({ type: 'kill_session', sessionId }));
    }
  }, []);

  const resizeSession = useCallback(
    (sessionId: string, cols: number, rows: number) => {
      if (globalWs && globalWs.readyState === WebSocket.OPEN) {
        globalWs.send(JSON.stringify({ type: 'resize', sessionId, cols, rows }));
      }
    },
    [],
  );

  return { connect, disconnect, send, sendInput, createSession, killSession, resizeSession };
}

function handleMessage(msg: ServerMessage) {
  switch (msg.type) {
    case 'auth_result':
      if (msg.success) {
        useConnectionStore.getState().setStatus('connected');
      } else {
        useConnectionStore.getState().setError(msg.error || 'Authentication failed.');
      }
      break;

    case 'session_created':
      // Terminal creation handled by the TerminalPage via store subscription
      window.dispatchEvent(
        new CustomEvent('reb:session-created', {
          detail: { sessionId: msg.sessionId, command: msg.command },
        }),
      );
      break;

    case 'session_ended':
      window.dispatchEvent(
        new CustomEvent('reb:session-ended', {
          detail: { sessionId: msg.sessionId, exitCode: msg.exitCode },
        }),
      );
      break;

    case 'error':
      console.error('[reb] Server error:', msg.message);
      break;
  }
}

function handleBinaryFrame(data: Uint8Array) {
  if (data.length < 17 || data[0] !== BINARY_OUTPUT_TAG) return;
  const sessionId = bytesToUuid(data, 1);
  const payload = data.slice(17);
  const session = useSessionStore.getState().sessions.get(sessionId);
  if (session) {
    session.term.write(payload);
  }
}
