/**
 * Image loading helpers shared across the diagram export / recovery paths.
 */

/** Load an image from any URL (data URL, blob URL, etc.). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/** Load an image from raw bytes, cleaning up the temporary object URL. */
export async function loadImageFromBytes(
  bytes: Uint8Array,
  type = "image/png"
): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
