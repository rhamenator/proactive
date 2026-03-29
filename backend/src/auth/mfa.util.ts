import { createHmac, randomBytes } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function normalizeBase32(secret: string) {
  return secret.toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
}

export function generateBase32Secret(length = 20) {
  const bytes = randomBytes(length);
  let bits = '';

  for (const value of bytes) {
    bits += value.toString(2).padStart(8, '0');
  }

  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }

  return output;
}

export function decodeBase32(secret: string) {
  const normalized = normalizeBase32(secret);
  let bits = '';

  for (const character of normalized) {
    const value = BASE32_ALPHABET.indexOf(character);
    if (value === -1) {
      throw new Error('Invalid base32 secret');
    }
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

export function generateTotp(secret: string, now = Date.now(), stepSeconds = 30, digits = 6) {
  const counter = Math.floor(now / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const key = decodeBase32(secret);
  const hash = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binaryCode =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return String(binaryCode % 10 ** digits).padStart(digits, '0');
}

export function verifyTotp(secret: string, token: string, options?: { now?: number; window?: number }) {
  const normalizedToken = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalizedToken)) {
    return false;
  }

  const now = options?.now ?? Date.now();
  const window = options?.window ?? 1;

  for (let offset = -window; offset <= window; offset += 1) {
    if (generateTotp(secret, now + offset * 30_000) === normalizedToken) {
      return true;
    }
  }

  return false;
}

export function buildOtpAuthUri(options: {
  issuer: string;
  accountName: string;
  secret: string;
}) {
  const issuer = encodeURIComponent(options.issuer);
  const accountName = encodeURIComponent(options.accountName);
  const secret = encodeURIComponent(options.secret);
  return `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
