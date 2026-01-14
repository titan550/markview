/**
 * Clipboard utilities for copying markdown and HTML.
 */

/**
 * Copy text to clipboard.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: create temporary textarea
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

/**
 * Copy HTML to clipboard with both HTML and plain text representations.
 */
export async function copyHtmlFragment(html: string, plainFallback: string): Promise<boolean> {
  try {
    // Try modern clipboard API with HTML MIME type
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plainFallback], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
  } catch {
    // Fall through to text copy
  }

  // Fallback: copy as plain text
  return copyText(html);
}

/**
 * Read text from clipboard.
 */
export async function readClipboardText(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}
