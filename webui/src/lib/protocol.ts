// Binary protocol helpers matching server/src/protocol.ts

export const BINARY_INPUT_TAG = 0x01;
export const BINARY_OUTPUT_TAG = 0x02;

export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function bytesToUuid(bytes: Uint8Array, offset = 0): string {
  const hex = Array.from(bytes.slice(offset, offset + 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

export function buildInputFrame(sessionId: string, data: string): ArrayBuffer {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const frame = new Uint8Array(17 + dataBytes.length);
  frame[0] = BINARY_INPUT_TAG;
  frame.set(uuidToBytes(sessionId), 1);
  frame.set(dataBytes, 17);
  return frame.buffer;
}

// Server → Client message types
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
}

export type ServerMessage =
  | AuthResultMessage
  | SessionCreatedMessage
  | SessionListMessage
  | SessionEndedMessage
  | ErrorMessage;
