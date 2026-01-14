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

  function onMouseDown(e: MouseEvent): void {
    isDragging = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  }

  function onMouseMove(e: MouseEvent): void {
    if (!isDragging) return;

    const containerRect = container.getBoundingClientRect();
    const handleWidth = handle.offsetWidth;
    const maxWidth = containerRect.width - minWidth - handleWidth;
    const newWidth = Math.max(minWidth, Math.min(e.clientX - containerRect.left, maxWidth));

    leftPane.style.width = `${newWidth}px`;
  }

  function onMouseUp(): void {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      // Save width to localStorage
      try {
        localStorage.setItem(storageKey, leftPane.style.width);
      } catch {
        // Ignore storage errors
      }
    }
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

  handle.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);

  // Touch support for mobile
  handle.addEventListener("touchstart", (e) => {
    isDragging = true;
    e.preventDefault();
  });

  document.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const containerRect = container.getBoundingClientRect();
    const handleWidth = handle.offsetWidth;
    const maxWidth = containerRect.width - minWidth - handleWidth;
    const newWidth = Math.max(minWidth, Math.min(touch.clientX - containerRect.left, maxWidth));
    leftPane.style.width = `${newWidth}px`;
  });

  document.addEventListener("touchend", () => {
    if (isDragging) {
      isDragging = false;
      try {
        localStorage.setItem(storageKey, leftPane.style.width);
      } catch {
        // Ignore storage errors
      }
    }
  });
}
