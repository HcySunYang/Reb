// ============================================================
// Reb Protocol — WebSocket message types between iOS ↔ Server
// ============================================================

// --- Client → Server ---

export interface AuthMessage {
  type: 'auth';
  token: string;
}

export interface CreateSessionMessage {
  type: 'create_session';
  cols: number;
  rows: number;
  cli?: string;     // 'claude' | 'copilot' — resolved server-side
  command?: string;  // custom command override
}

export interface InputMessage {
  type: 'input';
  sessionId: string;
  // data is sent as a separate binary frame immediately after this JSON frame
}

export interface ResizeMessage {
  type: 'resize';
  sessionId: string;
  cols: number;
  rows: number;
}

export interface ListSessionsMessage {
  type: 'list_sessions';
}

export interface KillSessionMessage {
  type: 'kill_session';
  sessionId: string;
}

export type ClientMessage =
  | AuthMessage
  | CreateSessionMessage
  | InputMessage
  | ResizeMessage
  | ListSessionsMessage
  | KillSessionMessage;

// --- Server → Client ---

export interface AuthResultMessage {
  type: 'auth_result';
  success: boolean;
  error?: string;
}

export interface SessionCreatedMessage {
  type: 'session_created';
  sessionId: string;
  command: string;
}

export interface OutputMessage {
  type: 'output';
  sessionId: string;
  // data is sent as a separate binary frame immediately after this JSON frame
}

export interface SessionListMessage {
  type: 'session_list';
  sessions: SessionInfo[];
}

export interface SessionInfo {
  id: string;
  pid: number;
  createdAt: string;
  command: string;
}

export interface SessionEndedMessage {
  type: 'session_ended';
  sessionId: string;
  exitCode: number;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  context?: string;
}

export type ServerMessage =
  | AuthResultMessage
  | SessionCreatedMessage
  | OutputMessage
  | SessionListMessage
  | SessionEndedMessage
  | ErrorMessage;

// --- Binary Frame Protocol ---
// For efficiency, terminal I/O uses a binary frame format:
//
// Client → Server (input):
//   [1 byte: 0x01] [16 bytes: sessionId as UUID] [rest: terminal data]
//
// Server → Client (output):
//   [1 byte: 0x02] [16 bytes: sessionId as UUID] [rest: terminal data]

export const BINARY_INPUT_TAG = 0x01;
export const BINARY_OUTPUT_TAG = 0x02;

// Helper: encode UUID string to 16-byte buffer
export function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

// Helper: decode 16-byte buffer to UUID string
export function bytesToUuid(buf: Buffer, offset: number = 0): string {
  const hex = buf.subarray(offset, offset + 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

// Build a binary output frame
export function buildOutputFrame(sessionId: string, data: Buffer): Buffer {
  const header = Buffer.alloc(17);
  header[0] = BINARY_OUTPUT_TAG;
  uuidToBytes(sessionId).copy(header, 1);
  return Buffer.concat([header, data]);
}

// Parse a binary input frame
export function parseInputFrame(frame: Buffer): { sessionId: string; data: Buffer } | null {
  if (frame.length < 17 || frame[0] !== BINARY_INPUT_TAG) return null;
  return {
    sessionId: bytesToUuid(frame, 1),
    data: frame.subarray(17),
  };
}
