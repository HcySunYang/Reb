import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useSessionStore, type Session } from '@/stores/sessionStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { SessionTabs } from '@/components/SessionTabs';
import { TerminalView } from '@/components/TerminalView';

const CLI_OPTIONS = [
  { id: 'claude', label: 'Claude' },
  { id: 'copilot', label: 'Copilot' },
] as const;

export function TerminalPage() {
  const { sessions, activeSessionId, addSession, removeSession, setActiveSession } =
    useSessionStore();
  const status = useConnectionStore((s) => s.status);
  const { disconnect, createSession, killSession, sendInput, resizeSession } = useWebSocket();
  const navigate = useNavigate();
  const sessionCountRef = useRef(0);
  const [showCliMenu, setShowCliMenu] = useState(false);

  // Handle session-created events from WebSocket
  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId, command } = (e as CustomEvent).detail;
      sessionCountRef.current++;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#e94560',
          selectionBackground: '#264f78',
          black: '#484f58',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#b1bac4',
          brightBlack: '#6e7681',
          brightRed: '#ffa198',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd',
          brightWhite: '#f0f6fc',
        },
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());

      // Wire input
      term.onData((data) => {
        sendInput(sessionId, data);
      });

      const session: Session = {
        id: sessionId,
        term,
        fitAddon,
        createdAt: new Date(),
        command: command || 'claude',
      };

      addSession(session);
    };

    window.addEventListener('reb:session-created', handler);
    return () => window.removeEventListener('reb:session-created', handler);
  }, [addSession, sendInput]);

  // Handle session-ended events
  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId, exitCode } = (e as CustomEvent).detail;
      const session = useSessionStore.getState().sessions.get(sessionId);
      if (session) {
        session.term.writeln(
          `\r\n\x1b[90m[Session ended with exit code ${exitCode}]\x1b[0m`,
        );
        setTimeout(() => removeSession(sessionId), 3000);
      }
    };

    window.addEventListener('reb:session-ended', handler);
    return () => window.removeEventListener('reb:session-ended', handler);
  }, [removeSession]);

  // Redirect if disconnected
  useEffect(() => {
    if (status === 'disconnected') {
      navigate('/', { replace: true });
    }
  }, [status, navigate]);

  const handleNewSession = useCallback(
    (cli: string) => {
      createSession(80, 24, cli);
      setShowCliMenu(false);
    },
    [createSession],
  );

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleKillSession = useCallback(
    (id: string) => {
      killSession(id);
    },
    [killSession],
  );

  const handleResize = useCallback(
    (sessionId: string, cols: number, rows: number) => {
      resizeSession(sessionId, cols, rows);
    },
    [resizeSession],
  );

  const sessionList = Array.from(sessions.values());

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-reb-border bg-reb-panel px-4 py-2 shrink-0">
        <span className="text-lg font-bold tracking-wide text-reb-red">REB</span>
        <span className="rounded-full bg-emerald-950 px-2.5 py-0.5 text-xs text-emerald-400">
          Connected
        </span>
        <div className="flex-1" />
        <div className="relative">
          <button
            onClick={() => setShowCliMenu((v) => !v)}
            className="rounded-md border border-reb-border bg-reb-panel px-3 py-1.5 text-xs text-gray-200 hover:bg-reb-border transition-colors"
          >
            + New Session ▾
          </button>
          {showCliMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowCliMenu(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-md border border-reb-border bg-reb-panel shadow-lg">
                {CLI_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleNewSession(opt.id)}
                    className="block w-full px-3 py-2 text-left text-xs text-gray-200 hover:bg-reb-border transition-colors first:rounded-t-md last:rounded-b-md"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={handleDisconnect}
          className="rounded-md border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950 transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Session tabs */}
      <SessionTabs
        sessions={sessionList}
        activeId={activeSessionId}
        onSelect={setActiveSession}
        onClose={handleKillSession}
      />

      {/* Terminal area */}
      <div className="relative flex-1 bg-black">
        {sessionList.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-600">
            Click "+ New Session" to start a Claude or Copilot session
          </div>
        ) : (
          sessionList.map((session) => (
            <TerminalView
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onResize={handleResize}
            />
          ))
        )}
      </div>
    </div>
  );
}
