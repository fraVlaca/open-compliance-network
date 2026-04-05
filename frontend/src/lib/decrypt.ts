/**
 * Client-side AES-256-GCM decryption using the Web Crypto API.
 *
 * The CRE identity-audit workflow encrypts Sumsub PII inside the TEE
 * and returns a hex string in the format:
 *   nonce(12 bytes) || ciphertext || authTag(16 bytes)
 *
 * Web Crypto's AES-GCM decrypt expects the tag appended to the
 * ciphertext, so we split off the 12-byte nonce and pass the rest
 * as-is.
 *
 * In CRE simulation mode, encryptOutput may not produce real ciphertext.
 * We attempt AES-GCM decryption first, then fall back to interpreting
 * the raw bytes as UTF-8 JSON.
 */

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function tryAesGcmDecrypt(raw: Uint8Array, keyHex: string): Promise<string> {
  // nonce = first 12 bytes, rest = ciphertext + GCM auth tag
  const nonce = raw.slice(0, 12);
  const ciphertextWithTag = raw.slice(12);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    hexToBytes(keyHex),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce, tagLength: 128 },
    cryptoKey,
    ciphertextWithTag,
  );

  return new TextDecoder().decode(plaintext);
}

export async function decryptIdentity(encryptedHex: string): Promise<Record<string, unknown>> {
  const keyHex = (import.meta as any).env?.VITE_AES_ENCRYPTION_KEY;

  const raw = hexToBytes(encryptedHex);

  // Minimum size: 12 (nonce) + 1 (ciphertext) + 16 (tag) = 29 bytes
  if (raw.length < 29) {
    // Too short for AES-GCM, try as raw UTF-8
    const text = new TextDecoder().decode(raw);
    return JSON.parse(text);
  }

  // Attempt 1: AES-256-GCM decryption (production / real DON)
  if (keyHex) {
    try {
      const text = await tryAesGcmDecrypt(raw, keyHex);
      return JSON.parse(text);
    } catch {
      // AES-GCM failed - likely simulation mode where encryptOutput
      // doesn't produce real ciphertext. Fall through to raw parse.
    }
  }

  // Attempt 2: Raw bytes might be unencrypted JSON (CRE simulation mode)
  try {
    const text = new TextDecoder().decode(raw);
    return JSON.parse(text);
  } catch {
    // Not valid JSON either
  }

  // Attempt 3: The hex string itself might be a JSON string (not hex-encoded bytes)
  try {
    return JSON.parse(encryptedHex);
  } catch {
    // Nothing worked
  }

  throw new Error(
    "Could not decrypt - data may not be AES-GCM encrypted (common in CRE simulation mode)"
  );
}
