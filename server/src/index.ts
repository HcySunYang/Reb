import dotenv from 'dotenv';
import { join } from 'path';
import { startServer } from './server';

// Load .env from the server directory regardless of CWD
dotenv.config({ path: join(__dirname, '..', '.env') });

const port = parseInt(process.env.PORT || '7680', 10);
const authTokenHash = process.env.AUTH_TOKEN_HASH || '';
const claudePath = process.env.CLAUDE_PATH || undefined;
const copilotPath = process.env.COPILOT_PATH || undefined;
const tlsCertPath = process.env.TLS_CERT_PATH || undefined;
const tlsKeyPath = process.env.TLS_KEY_PATH || undefined;

console.log('[reb] Reb Server starting...');
console.log(`[reb] Port: ${port}`);
console.log(`[reb] Claude path: ${claudePath || '(auto-detect)'}`);
console.log(`[reb] Copilot path: ${copilotPath || '(auto-detect)'}`);

startServer({
  port,
  authTokenHash,
  claudePath,
  copilotPath,
  tlsCertPath,
  tlsKeyPath,
});
