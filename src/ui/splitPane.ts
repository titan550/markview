/**
 * Resizable split pane functionality.
 */

export type SplitPaneOptions = {
  container: HTMLElement;
  leftPane: HTMLElement;
  rightPane: HTMLElement;
  handle: HTMLElement;
  minWidth?: number;
  storageKey?: string;
};

/**
 * Setup a resizable split pane.
 */
export function setupSplitPane(options: SplitPaneOptions): void {
  const {
    container,
    leftPane,
    handle,
    minWidth = 200,
    storageKey = "markview-split-width",
  } = options;

  let isDragging = false;

  function resizeTo(clientX: number): void {
    const rect = container.getBoundingClientRect();
    const maxWidth = rect.width - minWidth - handle.offsetWidth;
    const newWidth = Math.max(minWidth, Math.min(clientX - rect.left, maxWidth));
    leftPane.style.width = `${newWidth}px`;
  }

  function persistWidth(): void {
    try {
      localStorage.setItem(storageKey, leftPane.style.width);
    } catch {
      // Ignore storage errors
    }
  }

  function endDrag(): void {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    persistWidth();
  }

  // Restore saved width
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      leftPane.style.width = saved;
    }
  } catch {
    // Ignore storage errors
  }

  handle.addEventListener("mousedown", (e) => {
    isDragging = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (isDragging) resizeTo(e.clientX);
  });
  document.addEventListener("mouseup", endDrag);

  // Touch support for mobile
  handle.addEventListener("touchstart", (e) => {
    isDragging = true;
    e.preventDefault();
  });
  document.addEventListener("touchmove", (e) => {
    if (isDragging) resizeTo(e.touches[0].clientX);
  });
  document.addEventListener("touchend", endDrag);
}
