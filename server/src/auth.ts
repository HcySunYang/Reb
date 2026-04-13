import bcrypt from 'bcrypt';

interface AuthAttempt {
  count: number;
  resetAt: number;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

export class AuthService {
  private tokenHash: string;
  private attempts = new Map<string, AuthAttempt>();

  constructor(tokenHash: string) {
    if (!tokenHash) {
      throw new Error('AUTH_TOKEN_HASH is not configured. Run "npm run generate-token" to create one.');
    }
    this.tokenHash = tokenHash;
  }

  async verify(token: string, ip: string): Promise<{ ok: boolean; error?: string }> {
    // Rate limiting
    const now = Date.now();
    let attempt = this.attempts.get(ip);

    if (attempt) {
      if (now > attempt.resetAt) {
        attempt = { count: 0, resetAt: now + WINDOW_MS };
        this.attempts.set(ip, attempt);
      } else if (attempt.count >= MAX_ATTEMPTS) {
        return { ok: false, error: 'Too many auth attempts. Try again later.' };
      }
    } else {
      attempt = { count: 0, resetAt: now + WINDOW_MS };
      this.attempts.set(ip, attempt);
    }

    attempt.count++;

    try {
      const match = await bcrypt.compare(token, this.tokenHash);
      if (match) {
        // Reset on success
        this.attempts.delete(ip);
        return { ok: true };
      }
      return { ok: false, error: 'Invalid token.' };
    } catch {
      return { ok: false, error: 'Auth verification failed.' };
    }
  }

  // Cleanup old entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [ip, attempt] of this.attempts) {
      if (now > attempt.resetAt) {
        this.attempts.delete(ip);
      }
    }
  }
}
