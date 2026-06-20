/**
 * UTF-8 safe base64 encoding/decoding utilities.
 * These properly handle Unicode characters unlike btoa/atob.
 */

/**
 * Encode a UTF-8 string to base64.
 */
export function utf8ToBase64(s: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(s);
  return bytesToBase64(bytes);
}

/**
 * Decode a base64 string to UTF-8.
 */
export function base64ToUtf8(b64: string): string {
  const bytes = base64ToBytes(b64);
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Convert a Uint8Array to base64 string.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  // For large arrays, chunk to avoid call stack size exceeded
  const CHUNK_SIZE = 8192;
  let binary = "";

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

/**
 * Convert a base64 string to Uint8Array.
 */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}
