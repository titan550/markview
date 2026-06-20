/**
 * PNG chunk manipulation for embedding metadata.
 *
 * PNG structure:
 * - Signature: 8 bytes (137 80 78 71 13 10 26 10)
 * - Chunks: [length(4)][type(4)][data(length)][crc(4)]
 *
 * iTXt chunk structure:
 * - Keyword: null-terminated Latin-1 (1-79 bytes + null)
 * - Compression flag: 1 byte (0 = uncompressed, 1 = compressed)
 * - Compression method: 1 byte (0 = deflate)
 * - Language tag: null-terminated (can be empty)
 * - Translated keyword: null-terminated (can be empty)
 * - Text: UTF-8
 */

import { crc32 } from "./markviewPayload";

// PNG signature
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

// Chunk types
const CHUNK_IEND = "IEND";
const CHUNK_ITXT = "iTXt";

// Our metadata keyword
const KEYWORD = "markview";

/**
 * Check if bytes represent a valid PNG
 */
export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) {
    return false;
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Read a 32-bit big-endian unsigned integer
 */
function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

/**
 * Write a 32-bit big-endian unsigned integer
 */
function writeU32BE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >> 24) & 0xff;
  bytes[offset + 1] = (value >> 16) & 0xff;
  bytes[offset + 2] = (value >> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

/**
 * Get chunk type as string
 */
function getChunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  );
}

/**
 * Read a null-terminated string from bytes
 */
function readNullTerminated(
  bytes: Uint8Array,
  start: number,
  maxLen: number
): { str: string; end: number } | null {
  for (let i = start; i < start + maxLen && i < bytes.length; i++) {
    if (bytes[i] === 0) {
      const str = String.fromCharCode(...bytes.slice(start, i));
      return { str, end: i + 1 };
    }
  }
  return null;
}

/**
 * Extract the markview text from a PNG's iTXt chunk
 */
export function extractMarkviewText(pngBytes: Uint8Array): string | null {
  if (!isPng(pngBytes)) {
    return null;
  }

  let offset = PNG_SIGNATURE.length;

  while (offset + 12 <= pngBytes.length) {
    const length = readU32BE(pngBytes, offset);
    const type = getChunkType(pngBytes, offset + 4);

    // Prevent infinite loops on malformed data
    if (length > pngBytes.length - offset - 12) {
      break;
    }

    if (type === CHUNK_ITXT) {
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;

      if (dataEnd > pngBytes.length) break;

      const chunkData = pngBytes.slice(dataStart, dataEnd);

      // Parse iTXt: keyword (null) compression_flag compression_method language_tag (null) translated_keyword (null) text
      const keyword = readNullTerminated(chunkData, 0, 80);
      if (!keyword || keyword.str !== KEYWORD) {
        offset += 12 + length;
        continue;
      }

      // Check compression flag and method
      const flagOffset = keyword.end;
      if (flagOffset + 2 > chunkData.length) {
        offset += 12 + length;
        continue;
      }

      const compressionFlag = chunkData[flagOffset];

      // Skip language tag
      const langTag = readNullTerminated(chunkData, flagOffset + 2, 80);
      if (!langTag) {
        offset += 12 + length;
        continue;
      }

      // Skip translated keyword
      const transKeyword = readNullTerminated(chunkData, langTag.end, 80);
      if (!transKeyword) {
        offset += 12 + length;
        continue;
      }

      // Get text (rest of chunk)
      const textStart = transKeyword.end;
      const textBytes = chunkData.slice(textStart);

      if (compressionFlag === 0) {
        // Uncompressed - decode as UTF-8
        const decoder = new TextDecoder();
        return decoder.decode(textBytes);
      } else {
        // Compressed - we don't support this for now
        // Could use pako.inflate if needed
        continue;
      }
    }

    if (type === CHUNK_IEND) {
      break;
    }

    offset += 12 + length;
  }

  return null;
}

/**
 * Create an iTXt chunk with the markview keyword
 */
function createMarkviewITxtChunk(text: string): Uint8Array {
  const encoder = new TextEncoder();
  const keywordBytes = encoder.encode(KEYWORD);
  const textBytes = encoder.encode(text);

  // iTXt data:
  // keyword + null + compression_flag(0) + compression_method(0) + lang_tag + null + translated_keyword + null + text
  const dataLength = keywordBytes.length + 1 + 2 + 1 + 1 + textBytes.length;
  const chunkData = new Uint8Array(dataLength);

  let offset = 0;

  // Keyword
  chunkData.set(keywordBytes, offset);
  offset += keywordBytes.length;
  chunkData[offset++] = 0; // null terminator

  // Compression flag (0 = uncompressed)
  chunkData[offset++] = 0;

  // Compression method (0 = deflate, but irrelevant when flag is 0)
  chunkData[offset++] = 0;

  // Language tag (empty, null terminated)
  chunkData[offset++] = 0;

  // Translated keyword (empty, null terminated)
  chunkData[offset++] = 0;

  // Text
  chunkData.set(textBytes, offset);

  // Build full chunk: length(4) + type(4) + data + crc(4)
  const typeBytes = encoder.encode(CHUNK_ITXT);
  const chunkLength = 4 + 4 + dataLength + 4;
  const chunk = new Uint8Array(chunkLength);

  // Length
  writeU32BE(chunk, 0, dataLength);

  // Type
  chunk.set(typeBytes, 4);

  // Data
  chunk.set(chunkData, 8);

  // CRC (over type + data)
  const crcData = new Uint8Array(4 + dataLength);
  crcData.set(typeBytes, 0);
  crcData.set(chunkData, 4);
  const crcValue = crc32(crcData);
  writeU32BE(chunk, 8 + dataLength, crcValue);

  return chunk;
}

/**
 * Find all markview iTXt chunks and remove them
 */
function removeMarkviewChunks(pngBytes: Uint8Array): Uint8Array {
  if (!isPng(pngBytes)) {
    return pngBytes;
  }

  const chunks: Uint8Array[] = [];
  let offset = PNG_SIGNATURE.length;

  // Add signature
  chunks.push(PNG_SIGNATURE);

  while (offset + 12 <= pngBytes.length) {
    const length = readU32BE(pngBytes, offset);
    const type = getChunkType(pngBytes, offset + 4);

    // Prevent infinite loops
    if (length > pngBytes.length - offset - 12) {
      break;
    }

    const chunkSize = 12 + length;
    const chunk = pngBytes.slice(offset, offset + chunkSize);

    // Check if it's a markview iTXt chunk
    let isMarkviewChunk = false;
    if (type === CHUNK_ITXT) {
      const dataStart = 8;
      const keyword = readNullTerminated(chunk, dataStart, 80);
      if (keyword && keyword.str === KEYWORD) {
        isMarkviewChunk = true;
      }
    }

    // Skip markview chunks, keep all others
    if (!isMarkviewChunk) {
      chunks.push(chunk);
    }

    offset += chunkSize;
  }

  // Concatenate all chunks
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of chunks) {
    result.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  return result;
}

/**
 * Inject a markview iTXt chunk into a PNG (before IEND)
 */
export function injectMarkviewITXt(pngBytes: Uint8Array, text: string): Uint8Array {
  if (!isPng(pngBytes)) {
    throw new Error("Not a valid PNG");
  }

  // First, remove any existing markview chunks
  const cleanedPng = removeMarkviewChunks(pngBytes);

  // Find IEND position
  let iendOffset = -1;
  let offset = PNG_SIGNATURE.length;

  while (offset + 12 <= cleanedPng.length) {
    const length = readU32BE(cleanedPng, offset);
    const type = getChunkType(cleanedPng, offset + 4);

    if (type === CHUNK_IEND) {
      iendOffset = offset;
      break;
    }

    offset += 12 + length;
  }

  if (iendOffset === -1) {
    throw new Error("PNG missing IEND chunk");
  }

  // Create the new iTXt chunk
  const itxtChunk = createMarkviewITxtChunk(text);

  // Build new PNG: everything before IEND + iTXt chunk + IEND
  const beforeIend = cleanedPng.slice(0, iendOffset);
  const iendChunk = cleanedPng.slice(iendOffset);

  const newPng = new Uint8Array(beforeIend.length + itxtChunk.length + iendChunk.length);
  newPng.set(beforeIend, 0);
  newPng.set(itxtChunk, beforeIend.length);
  newPng.set(iendChunk, beforeIend.length + itxtChunk.length);

  return newPng;
}
