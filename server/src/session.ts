import * as pty from 'node-pty';
import { v4 as uuidv4 } from 'uuid';
import { SessionInfo } from './protocol';

export interface PtySession {
  id: string;
  pty: pty.IPty;
  createdAt: Date;
  command: string;
}

type DataCallback = (sessionId: string, data: Buffer) => void;
type ExitCallback = (sessionId: string, exitCode: number) => void;

export class SessionManager {
  private sessions = new Map<string, PtySession>();
  private dataListeners: DataCallback[] = [];
  private exitListeners: ExitCallback[] = [];
  private claudePath: string;

  constructor(claudePath?: string) {
    this.claudePath = claudePath || 'claude';
  }

  onData(cb: DataCallback): void {
    this.dataListeners.push(cb);
  }

  onExit(cb: ExitCallback): void {
    this.exitListeners.push(cb);
  }

  create(cols: number, rows: number, command?: string): string {
    const id = uuidv4();
    const targetCommand = command || this.claudePath;

    // Spawn through a login shell to ensure proper PATH and environment
    const proc = pty.spawn('/bin/zsh', ['-l', '-c', targetCommand], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME || '/',
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      } as { [key: string]: string },
    });

    const session: PtySession = {
      id,
      pty: proc,
      createdAt: new Date(),
      command: targetCommand,
    };

    proc.onData((data: string) => {
      const buf = Buffer.from(data, 'utf-8');
      for (const cb of this.dataListeners) {
        cb(id, buf);
      }
    });

    proc.onExit(({ exitCode }) => {
      this.sessions.delete(id);
      for (const cb of this.exitListeners) {
        cb(id, exitCode);
      }
    });

    this.sessions.set(id, session);
    return id;
  }

  write(sessionId: string, data: string | Buffer): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.write(typeof data === 'string' ? data : data.toString('utf-8'));
    return true;
  }

  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.resize(cols, rows);
    return true;
  }

  kill(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.kill();
    this.sessions.delete(sessionId);
    return true;
  }

  list(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      pid: s.pty.pid,
      createdAt: s.createdAt.toISOString(),
      command: s.command,
    }));
  }

  get(sessionId: string): PtySession | undefined {
    return this.sessions.get(sessionId);
  }

  destroyAll(): void {
    for (const session of this.sessions.values()) {
      session.pty.kill();
    }
    this.sessions.clear();
  }
}
