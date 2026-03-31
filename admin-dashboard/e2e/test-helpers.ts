import { createHmac } from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';

export function generateTotp(secret: string, now = Date.now(), stepSeconds = 30, digits = 6) {
  const normalized = secret.toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  let bits = '';
  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index < 0) {
      throw new Error('Invalid base32 secret for TOTP test helper');
    }
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }

  const counter = Math.floor(now / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hash = createHmac('sha1', Buffer.from(bytes)).update(counterBuffer).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binaryCode =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return String(binaryCode % 10 ** digits).padStart(digits, '0');
}

export async function seedAdminSession(page: Page, context: BrowserContext, options: {
  token: string;
  user: Record<string, unknown>;
}) {
  await context.addInitScript(({ token, user }) => {
    window.localStorage.setItem('proactive.admin.token', token);
    window.localStorage.setItem('proactive.admin.user', JSON.stringify(user));
  }, options);
  await page.goto('/dashboard');
}
