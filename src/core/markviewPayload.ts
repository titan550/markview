/**
 * Markview payload envelope - binary format for embedding diagram source.
 *
 * Envelope format:
 * - Magic: "MV" (2 bytes)
 * - Version: 1 (1 byte)
 * - Compression: 1 = deflate-raw (1 byte)
 * - CRC32 of uncompressed TLV body (4 bytes BE)
 * - Body length (compressed) (4 bytes BE)
 * - Compressed TLV body
 *
 * TLV format:
 * - Type 0x01: lang (u16 length + UTF-8 bytes)
 * - Type 0x02: src (u32 length + UTF-8 bytes)
 */

// Limits
export const MAX_UNCOMPRESSED = 200_000;
export const MAX_COMPRESSED = 80_000;

// Prefix for the base64 envelope stored in a PNG iTXt chunk.
export const MV_METADATA_PREFIX = "MV1:";

// Magic bytes
const MAGIC = new Uint8Array([0x4d, 0x56]); // "MV"
const VERSION = 1;
const COMPRESSION_DEFLATE = 1;

// TLV types
const TLV_LANG = 0x01;
const TLV_SRC = 0x02;

export interface DiagramPayload {
  lang: string;
  src: string;
}

/**
 * CRC32 lookup table (IEEE polynomial)
 */
const crc32Table: number[] = [];
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crc32Table[i] = c >>> 0;
}

/**
 * Calculate CRC32 checksum
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crc32Table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Encode a TLV field with u16 length prefix
 */
function encodeTlvU16(type: number, data: Uint8Array): Uint8Array {
  if (data.length > 0xffff) {
    throw new Error("TLV data too large for u16 length");
  }
  const result = new Uint8Array(1 + 2 + data.length);
  result[0] = type;
  result[1] = (data.length >> 8) & 0xff;
  result[2] = data.length & 0xff;
  result.set(data, 3);
  return result;
}

/**
 * Encode a TLV field with u32 length prefix
 */
function encodeTlvU32(type: number, data: Uint8Array): Uint8Array {
  const result = new Uint8Array(1 + 4 + data.length);
  result[0] = type;
  result[1] = (data.length >> 24) & 0xff;
  result[2] = (data.length >> 16) & 0xff;
  result[3] = (data.length >> 8) & 0xff;
  result[4] = data.length & 0xff;
  result.set(data, 5);
  return result;
}

/**
 * Encode a diagram payload to binary envelope
 */
export function encodePayload(payload: DiagramPayload): Uint8Array {
  const pako = window.pako;
  if (!pako) {
    throw new Error("pako compression library not available");
  }

  const encoder = new TextEncoder();
  const langBytes = encoder.encode(payload.lang);
  const srcBytes = encoder.encode(payload.src);

  // Build TLV body
  const langTlv = encodeTlvU16(TLV_LANG, langBytes);
  const srcTlv = encodeTlvU32(TLV_SRC, srcBytes);

  const tlvBody = new Uint8Array(langTlv.length + srcTlv.length);
  tlvBody.set(langTlv, 0);
  tlvBody.set(srcTlv, langTlv.length);

  // Check uncompressed size limit
  if (tlvBody.length > MAX_UNCOMPRESSED) {
    throw new Error(`Payload too large: ${tlvBody.length} > ${MAX_UNCOMPRESSED} bytes`);
  }

  // Calculate CRC32 of uncompressed body
  const checksum = crc32(tlvBody);

  // Compress
  const compressed = pako.deflateRaw(tlvBody, { level: 9 });

  // Check compressed size limit
  if (compressed.length > MAX_COMPRESSED) {
    throw new Error(`Compressed payload too large: ${compressed.length} > ${MAX_COMPRESSED} bytes`);
  }

  // Build envelope
  // Header: magic(2) + version(1) + compression(1) + crc32(4) + bodyLen(4) = 12 bytes
  const envelope = new Uint8Array(12 + compressed.length);

  // Magic
  envelope.set(MAGIC, 0);

  // Version
  envelope[2] = VERSION;

  // Compression
  envelope[3] = COMPRESSION_DEFLATE;

  // CRC32 (big-endian)
  envelope[4] = (checksum >> 24) & 0xff;
  envelope[5] = (checksum >> 16) & 0xff;
  envelope[6] = (checksum >> 8) & 0xff;
  envelope[7] = checksum & 0xff;

  // Body length (big-endian)
  envelope[8] = (compressed.length >> 24) & 0xff;
  envelope[9] = (compressed.length >> 16) & 0xff;
  envelope[10] = (compressed.length >> 8) & 0xff;
  envelope[11] = compressed.length & 0xff;

  // Compressed body
  envelope.set(compressed, 12);

  return envelope;
}

/**
 * Decode a binary envelope to diagram payload
 */
export function decodePayload(envelope: Uint8Array): DiagramPayload | null {
  const pako = window.pako;
  if (!pako) {
    return null;
  }

  try {
    // Check minimum size (header = 12 bytes)
    if (envelope.length < 12) {
      return null;
    }

    // Check magic
    if (envelope[0] !== MAGIC[0] || envelope[1] !== MAGIC[1]) {
      return null;
    }

    // Check version
    if (envelope[2] !== VERSION) {
      return null;
    }

    // Check compression type
    const compression = envelope[3];
    if (compression !== COMPRESSION_DEFLATE) {
      return null;
    }

    // Read CRC32
    const expectedCrc =
      ((envelope[4] << 24) | (envelope[5] << 16) | (envelope[6] << 8) | envelope[7]) >>> 0;

    // Read body length
    const bodyLen =
      ((envelope[8] << 24) | (envelope[9] << 16) | (envelope[10] << 8) | envelope[11]) >>> 0;

    // Validate body length
    if (bodyLen > MAX_COMPRESSED || bodyLen + 12 > envelope.length) {
      return null;
    }

    // Extract compressed body
    const compressed = envelope.slice(12, 12 + bodyLen);

    // Decompress
    const tlvBody = pako.inflateRaw(compressed);

    // Validate CRC32
    const actualCrc = crc32(tlvBody);
    if (actualCrc !== expectedCrc) {
      return null;
    }

    // Check uncompressed size
    if (tlvBody.length > MAX_UNCOMPRESSED) {
      return null;
    }

    // Parse TLV
    const decoder = new TextDecoder();
    let lang: string | null = null;
    let src: string | null = null;
    let offset = 0;

    while (offset < tlvBody.length) {
      if (offset + 1 > tlvBody.length) break;

      const type = tlvBody[offset];
      offset++;

      if (type === TLV_LANG) {
        // u16 length
        if (offset + 2 > tlvBody.length) return null;
        const len = (tlvBody[offset] << 8) | tlvBody[offset + 1];
        offset += 2;

        if (offset + len > tlvBody.length) return null;
        lang = decoder.decode(tlvBody.slice(offset, offset + len));
        offset += len;
      } else if (type === TLV_SRC) {
        // u32 length
        if (offset + 4 > tlvBody.length) return null;
        const len =
          ((tlvBody[offset] << 24) |
            (tlvBody[offset + 1] << 16) |
            (tlvBody[offset + 2] << 8) |
            tlvBody[offset + 3]) >>>
          0;
        offset += 4;

        if (offset + len > tlvBody.length) return null;
        src = decoder.decode(tlvBody.slice(offset, offset + len));
        offset += len;
      } else {
        // Unknown type - skip
        // We don't know the length format, so we can't skip properly
        // Return null to be safe
        return null;
      }
    }

    if (lang === null || src === null) {
      return null;
    }

    return { lang, src };
  } catch {
    return null;
  }
}
