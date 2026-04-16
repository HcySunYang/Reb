import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage, ServerResponse, createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer, ServerOptions } from 'https';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { AuthService } from './auth';
import { SessionManager } from './session';
import {
  ClientMessage,
  buildOutputFrame,
  parseInputFrame,
} from './protocol';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

interface ClientState {
  authenticated: boolean;
  ip: string;
  subscribedSessions: Set<string>;
}

export interface ServerConfig {
  port: number;
  authTokenHash: string;
  claudePath?: string;
  copilotPath?: string;
  tlsCertPath?: string;
  tlsKeyPath?: string;
}

export function startServer(config: ServerConfig): void {
  const auth = new AuthService(config.authTokenHash);
  const sessions = new SessionManager(config.claudePath);
  const clients = new Map<WebSocket, ClientState>();

  // Supported CLI tools and their paths
  const cliPaths: Record<string, string> = {
    claude: config.claudePath || 'claude',
    copilot: config.copilotPath || 'copilot',
  };

  // Cleanup auth rate-limit entries every 5 minutes
  setInterval(() => auth.cleanup(), 300_000);

  // Static file serving for web UI
  const publicDir = join(__dirname, '..', 'public');

  function serveStatic(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url === '/' ? '/index.html' : req.url || '/index.html';
    // Prevent path traversal
    const safePath = url.split('?')[0].replace(/\.\./g, '');
    const filePath = join(publicDir, safePath);

    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  // Create HTTP(S) server
  let httpServer;
  if (config.tlsCertPath && config.tlsKeyPath) {
    const tlsOpts: ServerOptions = {
      cert: readFileSync(config.tlsCertPath),
      key: readFileSync(config.tlsKeyPath),
    };
    httpServer = createHttpsServer(tlsOpts, serveStatic);
    console.log('[reb] TLS enabled');
  } else {
    httpServer = createHttpServer(serveStatic);
  }

  const wss = new WebSocketServer({ server: httpServer });

  // Broadcast PTY output to subscribed clients
  sessions.onData((sessionId, data) => {
    const frame = buildOutputFrame(sessionId, data);
    for (const [ws, state] of clients) {
      if (state.authenticated && state.subscribedSessions.has(sessionId)) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(frame);
        }
      }
    }
  });

  // Notify clients when a session ends
  sessions.onExit((sessionId, exitCode) => {
    const msg = JSON.stringify({ type: 'session_ended', sessionId, exitCode });
    for (const [ws, state] of clients) {
      if (state.authenticated && state.subscribedSessions.has(sessionId)) {
        state.subscribedSessions.delete(sessionId);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      }
    }
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
    console.log(`[reb] Client connected from ${ip}`);

    const state: ClientState = {
      authenticated: false,
      ip,
      subscribedSessions: new Set(),
    };
    clients.set(ws, state);

    // Heartbeat
    let alive = true;
    ws.on('pong', () => { alive = true; });
    const heartbeat = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, 30_000);

    ws.on('message', async (raw: RawData, isBinary: boolean) => {
      try {
        // Binary frame → PTY input
        if (isBinary) {
          if (!state.authenticated) return;
          const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
          const parsed = parseInputFrame(buf);
          if (!parsed) return;
          if (!state.subscribedSessions.has(parsed.sessionId)) return;
          sessions.write(parsed.sessionId, parsed.data);
          return;
        }

        // Text frame → JSON control message
        const msg: ClientMessage = JSON.parse(raw.toString());

        if (msg.type === 'auth') {
          const result = await auth.verify(msg.token, state.ip);
          state.authenticated = result.ok;
          ws.send(JSON.stringify({
            type: 'auth_result',
            success: result.ok,
            error: result.error,
          }));
          if (result.ok) {
            console.log(`[reb] Client ${ip} authenticated`);
          }
          return;
        }

        // All other messages require auth
        if (!state.authenticated) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated.' }));
          return;
        }

        switch (msg.type) {
          case 'create_session': {
            // Resolve command: cli name → path, or custom command, or default to claude
            let targetCommand: string;
            if (msg.cli && cliPaths[msg.cli]) {
              targetCommand = cliPaths[msg.cli];
            } else if (msg.command) {
              targetCommand = msg.command;
            } else {
              targetCommand = cliPaths['claude'];
            }
            const sessionId = sessions.create(msg.cols, msg.rows, targetCommand);
            state.subscribedSessions.add(sessionId);
            ws.send(JSON.stringify({ type: 'session_created', sessionId, command: targetCommand }));
            console.log(`[reb] Session ${sessionId} (${targetCommand}) created for ${ip}`);
            break;
          }

          case 'resize': {
            if (!state.subscribedSessions.has(msg.sessionId)) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not subscribed to session.', context: msg.sessionId }));
              break;
            }
            sessions.resize(msg.sessionId, msg.cols, msg.rows);
            break;
          }

          case 'list_sessions': {
            const list = sessions.list();
            ws.send(JSON.stringify({ type: 'session_list', sessions: list }));
            break;
          }

          case 'kill_session': {
            sessions.kill(msg.sessionId);
            state.subscribedSessions.delete(msg.sessionId);
            ws.send(JSON.stringify({ type: 'session_ended', sessionId: msg.sessionId, exitCode: -1 }));
            console.log(`[reb] Session ${msg.sessionId} killed by ${ip}`);
            break;
          }

          case 'input': {
            // Input data comes in the next binary frame, handled above.
            // This message is only used if client sends small inputs inline (fallback).
            break;
          }

          default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type.' }));
        }
      } catch (err) {
        console.error('[reb] Message handling error:', err);
        ws.send(JSON.stringify({ type: 'error', message: 'Internal server error.' }));
      }
    });

    ws.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(ws);
      console.log(`[reb] Client ${ip} disconnected`);
    });

    ws.on('error', (err) => {
      console.error(`[reb] WebSocket error for ${ip}:`, err.message);
    });
  });

  httpServer.listen(config.port, () => {
    console.log(`[reb] Server listening on port ${config.port}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('[reb] Shutting down...');
    sessions.destroyAll();
    wss.close();
    httpServer.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
