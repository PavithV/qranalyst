import { randomBytes } from "crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function toBase62(bytes: Buffer): string {
  // Convert raw bytes to a base62 string without requiring bigint.
  // We simply map each byte to a character index.
  const chars: string[] = [];
  for (const b of bytes) {
    chars.push(ALPHABET[b % ALPHABET.length]);
  }
  return chars.join("");
}

export function generateShortId(length = 12): string {
  if (length < 8 || length > 32) {
    throw new Error("generateShortId: length außerhalb des sinnvollen Bereichs.");
  }

  // Create enough entropy for the desired length.
  const bytesNeeded = Math.ceil(length);
  const bytes = randomBytes(bytesNeeded);
  const raw = toBase62(bytes);
  return raw.slice(0, length);
}

