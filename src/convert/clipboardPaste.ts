/**
 * Clipboard paste handling with diagram source recovery.
 *
 * Recovers diagram source from:
 * 1. Existing HTML data-* attributes (from markview exports)
 * 2. PNG metadata iTXt (embedded in images)
 * 3. QR codes in image footer (fallback when metadata is stripped)
 */

import { utf8ToBase64, base64ToBytes } from "../core/base64utf8";
import { decodePayload, MV_METADATA_PREFIX } from "../core/markviewPayload";
import { isPng, extractMarkviewText } from "../core/pngChunks";
import { decodeQrFromImage } from "../core/qrEmbed";
import type { TurndownInstance } from "./htmlToMarkdown";

// Limits
const MAX_IMAGES = 20;

/**
 * Try to recover diagram source from image bytes
 */
async function tryDecodeDiagramFromImage(
  imageBytes: Uint8Array
): Promise<{ lang: string; src: string } | null> {
  // Fast path: PNG iTXt metadata.
  if (isPng(imageBytes)) {
    const metadataText = extractMarkviewText(imageBytes);
    if (metadataText?.startsWith(MV_METADATA_PREFIX)) {
      try {
        const payload = decodePayload(base64ToBytes(metadataText.slice(MV_METADATA_PREFIX.length)));
        if (payload) return payload;
      } catch {
        // Fall through to QR.
      }
    }
  }

  // Fallback: QR codes (used when metadata was stripped, e.g. by email clients).
  try {
    const envelope = await decodeQrFromImage(imageBytes);
    if (envelope) {
      const payload = decodePayload(envelope);
      if (payload) return payload;
    }
  } catch {
    // No recoverable source.
  }

  return null;
}

/**
 * Resolve an image element to bytes
 */
async function resolveImageToBytes(
  img: HTMLImageElement,
  clipboardImageFiles: File[]
): Promise<Uint8Array | null> {
  const src = img.getAttribute("src") || "";

  try {
    // Data URL
    if (src.startsWith("data:")) {
      const base64Match = src.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        return base64ToBytes(base64Match[1]);
      }
      return null;
    }

    // Blob URL
    if (src.startsWith("blob:")) {
      const response = await fetch(src);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    // External URL - skip (security)
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return null;
    }

    // Try to match with clipboard image files (best effort for Word/Pages)
    // This is a fallback when images don't have data URLs
    if (clipboardImageFiles.length > 0) {
      const file = clipboardImageFiles.shift();
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Create a diagram figure element from recovered payload
 */
function createDiagramFigure(doc: Document, lang: string, src: string): HTMLElement {
  const figure = doc.createElement("figure");
  figure.className = "diagram";
  figure.setAttribute("data-diagram", lang);
  figure.setAttribute("data-source-base64", utf8ToBase64(src));
  return figure;
}

/**
 * Extracted clipboard data that can be processed asynchronously
 */
export interface ClipboardSnapshot {
  htmlContent: string;
  plainContent: string;
  imageFiles: File[];
}

/**
 * Synchronously extract clipboard data before any async operations.
 * This must be called in the synchronous part of the paste handler.
 */
export function extractClipboardData(e: ClipboardEvent): ClipboardSnapshot | null {
  const clipboardData = e.clipboardData;
  if (!clipboardData) return null;

  const htmlContent = clipboardData.getData("text/html");
  const plainContent = clipboardData.getData("text/plain");

  // Collect clipboard image files
  const imageFiles: File[] = [];
  for (const item of clipboardData.items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        imageFiles.push(file);
      }
    }
  }

  return { htmlContent, plainContent, imageFiles };
}

/**
 * Check if clipboard data might contain recoverable diagrams.
 * Used to decide whether to preventDefault synchronously.
 */
export function mightContainDiagrams(snapshot: ClipboardSnapshot): boolean {
  // Has image files directly
  if (snapshot.imageFiles.length > 0) {
    return true;
  }

  // Has HTML with images
  if (snapshot.htmlContent) {
    return /<img\s/i.test(snapshot.htmlContent);
  }

  return false;
}

/**
 * Recover diagram fences directly from raw clipboard image files (used when the
 * HTML references images we can't read, or for image-only pastes).
 */
async function recoverDiagramBlocks(files: File[]): Promise<string[]> {
  const blocks: string[] = [];
  for (const file of files.slice(0, MAX_IMAGES)) {
    try {
      const imageBytes = new Uint8Array(await file.arrayBuffer());
      const payload = await tryDecodeDiagramFromImage(imageBytes);
      if (payload) {
        blocks.push(`\`\`\`${payload.lang}\n${payload.src}\n\`\`\``);
      }
    } catch {
      // Skip unreadable images.
    }
  }
  return blocks;
}

/**
 * Process extracted clipboard data asynchronously to recover diagrams.
 * Returns markdown string or null if no conversion is needed.
 */
export async function processClipboardData(
  snapshot: ClipboardSnapshot,
  turndown: TurndownInstance
): Promise<string | null> {
  const { htmlContent } = snapshot;
  // Mutable copy; resolveImageToBytes consumes from it as a fallback.
  const clipboardImageFiles = [...snapshot.imageFiles];

  if (htmlContent) {
    const doc = new DOMParser().parseFromString(htmlContent, "text/html");

    // Strip scripts/styles for safety.
    for (const el of doc.querySelectorAll("script, style")) {
      el.remove();
    }

    const images = Array.from(doc.querySelectorAll("img")).slice(0, MAX_IMAGES);
    let anyRecovered = false;

    for (const img of images) {
      // Skip images already wrapped as a recovered diagram.
      const parent = img.parentElement;
      if (parent?.hasAttribute("data-diagram") && parent?.hasAttribute("data-source-base64")) {
        continue;
      }

      const imageBytes = await resolveImageToBytes(img as HTMLImageElement, clipboardImageFiles);
      if (!imageBytes) continue;

      const payload = await tryDecodeDiagramFromImage(imageBytes);
      if (payload) {
        img.parentNode?.replaceChild(createDiagramFigure(doc, payload.lang, payload.src), img);
        anyRecovered = true;
      }
    }

    if (anyRecovered) {
      return turndown.turndown(doc.body.innerHTML);
    }

    // Fall back to the raw clipboard image files and append any recovered diagrams.
    const recoveredBlocks = await recoverDiagramBlocks(clipboardImageFiles);
    if (recoveredBlocks.length > 0) {
      const cleanedHtml = doc.body.innerHTML.replace(/<!--[\s\S]*?-->/g, "");
      return turndown.turndown(cleanedHtml) + "\n\n" + recoveredBlocks.join("\n\n");
    }

    return null;
  }

  // Image-only paste.
  const recoveredBlocks = await recoverDiagramBlocks(clipboardImageFiles);
  return recoveredBlocks.length > 0 ? recoveredBlocks.join("\n\n") : null;
}
