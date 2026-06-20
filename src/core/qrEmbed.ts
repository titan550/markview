/**
 * QR code embedding for diagram source recovery.
 *
 * Uses QR codes as a fallback when PNG metadata is stripped (e.g., by email clients).
 * Generates 1-4 QR codes in a footer strip appended to the diagram image.
 */

import { crc32 } from "./markviewPayload";
import { loadImageFromBytes } from "./image";

// Constraints - empirically determined via scripts/find-qr-params.ts
// MIN_MODULE_PX: Minimum pixels per QR module.
// Search found 0.98px works, using 2.0px for safety margin against real-world degradation
const MIN_MODULE_PX = 2.0;

// QR size bounds - search found 64px works for ~70 char chunks
const MIN_QR_SIDE = 64;
const MAX_QR_SIDE = 96; // Keep small to minimize visual intrusion

// QR_SIZE_RATIO: What fraction of image width for each QR
const QR_SIZE_RATIO = 0.1; // Small footprint

const QR_MARGIN_MODULES = 2;
const MAX_CHUNKS = 4;

// QR ECC levels - L has best success rate (61.9%) due to higher capacity
// We have CRC32 in the payload for integrity checking
const ECC_LEVELS = ["L", "M", "Q"] as const;
type EccLevel = (typeof ECC_LEVELS)[number];

// Base45 alphabet (alphanumeric for QR efficiency)
const BASE45_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

export interface QrChunk {
  msgid: string;
  index: number;
  total: number;
  data: string; // base45 encoded
}

export interface QrPlan {
  ecc: EccLevel;
  chunks: QrChunk[];
  qrSidePx: number;
  moduleCount: number;
}

/**
 * Encode bytes to base45 string
 */
export function base45Encode(bytes: Uint8Array): string {
  const result: string[] = [];

  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      // Two bytes -> three base45 chars
      const n = bytes[i] * 256 + bytes[i + 1];
      result.push(BASE45_ALPHABET[n % 45]);
      result.push(BASE45_ALPHABET[Math.floor(n / 45) % 45]);
      result.push(BASE45_ALPHABET[Math.floor(n / 2025)]);
    } else {
      // One byte -> two base45 chars
      const n = bytes[i];
      result.push(BASE45_ALPHABET[n % 45]);
      result.push(BASE45_ALPHABET[Math.floor(n / 45)]);
    }
  }

  return result.join("");
}

/**
 * Decode base45 string to bytes
 */
export function base45Decode(str: string): Uint8Array | null {
  try {
    const result: number[] = [];

    for (let i = 0; i < str.length; i += 3) {
      const chars = str.slice(i, i + 3);

      if (chars.length === 3) {
        // Three chars -> two bytes
        const c0 = BASE45_ALPHABET.indexOf(chars[0]);
        const c1 = BASE45_ALPHABET.indexOf(chars[1]);
        const c2 = BASE45_ALPHABET.indexOf(chars[2]);

        if (c0 < 0 || c1 < 0 || c2 < 0) return null;

        const n = c0 + c1 * 45 + c2 * 2025;
        result.push(Math.floor(n / 256));
        result.push(n % 256);
      } else if (chars.length === 2) {
        // Two chars -> one byte
        const c0 = BASE45_ALPHABET.indexOf(chars[0]);
        const c1 = BASE45_ALPHABET.indexOf(chars[1]);

        if (c0 < 0 || c1 < 0) return null;

        const n = c0 + c1 * 45;
        result.push(n);
      } else {
        return null;
      }
    }

    return new Uint8Array(result);
  } catch {
    return null;
  }
}

/**
 * Generate a message ID from envelope bytes (hex CRC32)
 */
function generateMsgId(envelope: Uint8Array): string {
  const checksum = crc32(envelope);
  return checksum.toString(16).padStart(8, "0").toUpperCase();
}

/**
 * Format a QR chunk string: MV1/<msgid>/<i>/<n>:<base45data>
 */
function formatChunkString(chunk: QrChunk): string {
  return `MV1/${chunk.msgid}/${chunk.index}/${chunk.total}:${chunk.data}`;
}

/**
 * Parse a QR chunk string
 */
export function parseChunkString(str: string): QrChunk | null {
  const match = str.match(/^MV1\/([A-F0-9]{8})\/(\d+)\/(\d+):(.+)$/);
  if (!match) return null;

  const [, msgid, indexStr, totalStr, data] = match;
  const index = parseInt(indexStr, 10);
  const total = parseInt(totalStr, 10);

  if (index < 1 || index > total || total > MAX_CHUNKS) return null;

  return { msgid, index, total, data };
}

/**
 * Get QR module count for a given data length and ECC level
 * This estimates the QR version needed
 */
function estimateQrModuleCount(dataLength: number, ecc: EccLevel): number {
  // Approximate alphanumeric capacities per version and ECC level
  // These are conservative estimates
  const capacities: Record<EccLevel, number[]> = {
    L: [25, 47, 77, 114, 154, 195, 224, 279, 335, 395, 468, 535, 619, 667, 758, 854, 938, 1046],
    M: [20, 38, 61, 90, 122, 154, 178, 221, 262, 311, 366, 419, 483, 528, 600, 656, 734, 816],
    Q: [16, 29, 47, 67, 87, 108, 125, 157, 189, 221, 259, 296, 352, 376, 426, 470, 531, 574],
  };

  const caps = capacities[ecc];
  for (let version = 1; version <= caps.length; version++) {
    if (caps[version - 1] >= dataLength) {
      // Module count = 17 + version * 4
      return 17 + version * 4;
    }
  }

  // Too large for QR
  return -1;
}

/**
 * Check if a QR code fits within constraints
 */
function qrFitsConstraints(moduleCount: number, qrSidePx: number): boolean {
  if (moduleCount < 0) return false;

  const totalModules = moduleCount + 2 * QR_MARGIN_MODULES;
  const modulePx = qrSidePx / totalModules;

  return modulePx >= MIN_MODULE_PX;
}

/**
 * Plan QR chunks for an envelope
 * Returns null if QR is not feasible
 */
export function planQrChunks(envelope: Uint8Array, imageWidth: number): QrPlan | null {
  const qrcode = window.qrcode;
  if (!qrcode) return null;

  // Calculate QR side size
  const qrSidePx = Math.max(
    MIN_QR_SIDE,
    Math.min(MAX_QR_SIDE, Math.round(imageWidth * QR_SIZE_RATIO))
  );

  const msgid = generateMsgId(envelope);
  const base45 = base45Encode(envelope);

  // Try each ECC level
  for (const ecc of ECC_LEVELS) {
    // Try each chunk count
    for (let numChunks = 1; numChunks <= MAX_CHUNKS; numChunks++) {
      const chunkDataSize = Math.ceil(base45.length / numChunks);
      const chunks: QrChunk[] = [];

      let allFit = true;

      for (let i = 0; i < numChunks; i++) {
        const start = i * chunkDataSize;
        const end = Math.min(start + chunkDataSize, base45.length);
        const data = base45.slice(start, end);

        const chunk: QrChunk = {
          msgid,
          index: i + 1,
          total: numChunks,
          data,
        };

        chunks.push(chunk);

        // Check if this chunk's QR code fits
        const chunkStr = formatChunkString(chunk);
        const moduleCount = estimateQrModuleCount(chunkStr.length, ecc);

        if (!qrFitsConstraints(moduleCount, qrSidePx)) {
          allFit = false;
          break;
        }
      }

      if (allFit && chunks.length > 0) {
        // Verify with actual QR generation
        const chunkStr = formatChunkString(chunks[0]);
        try {
          const qr = qrcode(0, ecc);
          qr.addData(chunkStr);
          qr.make();
          const actualModules = qr.getModuleCount();

          if (qrFitsConstraints(actualModules, qrSidePx)) {
            return {
              ecc,
              chunks,
              qrSidePx,
              moduleCount: actualModules,
            };
          }
        } catch {
          // QR generation failed, try next option
        }
      }
    }
  }

  return null;
}

/**
 * Render a QR code to a canvas
 */
function renderQrToCanvas(qrStr: string, ecc: EccLevel, size: number): HTMLCanvasElement | null {
  const qrcode = window.qrcode;
  if (!qrcode) return null;

  try {
    const qr = qrcode(0, ecc);
    qr.addData(qrStr);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const cellSize = size / (moduleCount + 2 * QR_MARGIN_MODULES);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    // Draw QR modules
    ctx.fillStyle = "#000000";
    const offset = QR_MARGIN_MODULES * cellSize;

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
        }
      }
    }

    return canvas;
  } catch {
    return null;
  }
}

/**
 * Composite QR footer onto an image
 * Returns new PNG bytes with footer
 */
export async function compositeQrFooter(pngBytes: Uint8Array, plan: QrPlan): Promise<Uint8Array> {
  const img = await loadImageFromBytes(pngBytes);
  const { width, height } = img;

  // Calculate footer dimensions
  const qrSize = plan.qrSidePx;
  const qrPadding = 8;
  const footerHeight = qrSize + qrPadding * 2;

  // Render QR codes
  const qrCanvases: HTMLCanvasElement[] = [];
  for (const chunk of plan.chunks) {
    const qrStr = formatChunkString(chunk);
    const qrCanvas = renderQrToCanvas(qrStr, plan.ecc, qrSize);
    if (!qrCanvas) {
      throw new Error("Failed to render QR code");
    }
    qrCanvases.push(qrCanvas);
  }

  // Create composite canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height + footerHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Draw original image
  ctx.drawImage(img, 0, 0);

  // Draw white footer
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, height, width, footerHeight);

  // Calculate QR positions (right-aligned)
  const totalQrWidth = qrCanvases.length * qrSize + (qrCanvases.length - 1) * qrPadding;
  let qrX = width - totalQrWidth - qrPadding;
  const qrY = height + qrPadding;

  // Draw QR codes
  for (const qrCanvas of qrCanvases) {
    ctx.drawImage(qrCanvas, qrX, qrY);
    qrX += qrSize + qrPadding;
  }

  // Convert to PNG bytes
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("Failed to create PNG blob"));
          return;
        }

        const arrayBuffer = await blob.arrayBuffer();
        resolve(new Uint8Array(arrayBuffer));
      },
      "image/png",
      1.0
    );
  });
}

/**
 * Decode QR codes from an image and return the assembled envelope bytes, or null.
 *
 * Scans progressively wider regions and stops as soon as a complete chunk set is
 * found: footer (where the QR footer is composited) → overlapping footer strips →
 * a tile sweep across the bottom → the full image and its quadrants.
 */
export async function decodeQrFromImage(imageBytes: Uint8Array): Promise<Uint8Array | null> {
  const jsQR = window.jsQR;
  if (!jsQR) return null;

  const img = await loadImageFromBytes(imageBytes);
  const { width, height } = img;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Downscale large images to ~2MP for the scaled scans.
  const maxPixels = 2_000_000;
  const scale = width * height > maxPixels ? Math.sqrt(maxPixels / (width * height)) : 1;

  // Recovered chunks keyed by message id.
  const chunks = new Map<string, QrChunk[]>();

  const addChunk = (chunk: QrChunk): void => {
    let msgChunks = chunks.get(chunk.msgid);
    if (!msgChunks) {
      msgChunks = [];
      chunks.set(chunk.msgid, msgChunks);
    }
    if (!msgChunks.some((c) => c.index === chunk.index)) {
      msgChunks.push(chunk);
    }
  };

  const haveAllChunks = (): boolean => {
    for (const msgChunks of chunks.values()) {
      if (msgChunks.length > 0 && msgChunks.length >= msgChunks[0].total) return true;
    }
    return false;
  };

  const decodeCanvas = (w: number, h: number): void => {
    const imageData = ctx.getImageData(0, 0, w, h);
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });
    if (result) {
      const chunk = parseChunkString(result.data);
      if (chunk) addChunk(chunk);
    }
  };

  // Scan a region downscaled to the 2MP working resolution.
  const scanRect = (srcX: number, srcY: number, srcW: number, srcH: number): void => {
    const dstW = Math.floor(srcW * scale);
    const dstH = Math.floor(srcH * scale);
    if (dstW < 10 || dstH < 10) return;
    canvas.width = dstW;
    canvas.height = dstH;
    ctx.clearRect(0, 0, dstW, dstH);
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dstW, dstH);
    decodeCanvas(dstW, dstH);
  };

  // Scan a region at 1:1 (better detection for small QR codes).
  const scanRect1to1 = (srcX: number, srcY: number, srcW: number, srcH: number): void => {
    if (srcW < 10 || srcH < 10) return;
    canvas.width = srcW;
    canvas.height = srcH;
    ctx.clearRect(0, 0, srcW, srcH);
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
    decodeCanvas(srcW, srcH);
  };

  // Footer region, where the QR strip is composited (typically right-aligned).
  const footerHeight = Math.floor(height * 0.35);
  const footerTop = height - footerHeight;

  // Bottom-right corner first (most likely), then the whole footer.
  const qrRegionWidth = Math.min(400, width);
  const qrRegionHeight = Math.min(250, footerHeight);
  scanRect1to1(width - qrRegionWidth, height - qrRegionHeight, qrRegionWidth, qrRegionHeight);
  scanRect1to1(0, footerTop, width, footerHeight);
  scanRect(0, footerTop, width, footerHeight);

  // Still missing chunks: scan overlapping footer strips for additional QR codes.
  if (!haveAllChunks() && chunks.size > 0) {
    const strips = [
      { x: 0, w: width / 2 },
      { x: width / 2, w: width / 2 },
      { x: 0, w: width / 3 },
      { x: width / 3, w: width / 3 },
      { x: (2 * width) / 3, w: width / 3 },
      { x: 0, w: width / 4 },
      { x: width / 4, w: width / 4 },
      { x: width / 2, w: width / 4 },
      { x: (3 * width) / 4, w: width / 4 },
    ];
    for (const strip of strips) {
      scanRect1to1(strip.x, footerTop, strip.w, footerHeight);
      if (haveAllChunks()) break;
    }
  }

  // Still missing: sweep QR-sized tiles across the bottom of the image.
  if (!haveAllChunks()) {
    const tileSize = 200;
    const bottomRegion = Math.min(300, height);
    for (let x = width - tileSize; x >= 0 && !haveAllChunks(); x -= tileSize / 2) {
      for (let y = height - bottomRegion; y < height; y += tileSize / 2) {
        scanRect1to1(x, y, Math.min(tileSize, width - x), Math.min(tileSize, height - y));
      }
    }
  }

  // Last resort: scan the full image and its quadrants.
  if (!haveAllChunks()) {
    const halfW = width / 2;
    const halfH = height / 2;
    scanRect1to1(0, 0, width, height);
    scanRect1to1(0, 0, halfW, halfH);
    scanRect1to1(halfW, 0, halfW, halfH);
    scanRect1to1(0, halfH, halfW, halfH);
    scanRect1to1(halfW, halfH, halfW, halfH);
  }

  // Assemble a complete, in-order chunk set into envelope bytes.
  for (const msgChunks of chunks.values()) {
    const total = msgChunks[0]?.total;
    if (!total || msgChunks.length !== total) continue;

    msgChunks.sort((a, b) => a.index - b.index);
    if (!msgChunks.every((c, i) => c.index === i + 1)) continue;

    const envelope = base45Decode(msgChunks.map((c) => c.data).join(""));
    if (envelope) return envelope;
  }

  return null;
}
