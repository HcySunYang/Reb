import { create } from 'zustand';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

export interface Session {
  id: string;
  term: Terminal;
  fitAddon: FitAddon;
  createdAt: Date;
}

interface SessionState {
  sessions: Map<string, Session>;
  activeSessionId: string | null;

  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  clearAll: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,

  addSession: (session) => {
    const sessions = new Map(get().sessions);
    sessions.set(session.id, session);
    set({ sessions, activeSessionId: session.id });
  },

  removeSession: (id) => {
    const sessions = new Map(get().sessions);
    const session = sessions.get(id);
    if (session) {
      session.term.dispose();
    }
    sessions.delete(id);
    const { activeSessionId } = get();
    const newActive =
      activeSessionId === id
        ? (sessions.keys().next().value ?? null)
        : activeSessionId;
    set({ sessions, activeSessionId: newActive });
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  clearAll: () => {
    const { sessions } = get();
    for (const session of sessions.values()) {
      session.term.dispose();
    }
    set({ sessions: new Map(), activeSessionId: null });
  },
}));
