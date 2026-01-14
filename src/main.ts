/**
 * markview - Markdown to HTML converter with diagram support
 * Main application entry point
 */

import { setupSplitPane } from "./ui/splitPane";
import { copyHtmlFragment, copyText } from "./ui/clipboard";
import { createRenderPipeline } from "./render/pipeline";
import { autofixMarkdownDiagrams } from "./core/autofix";
import { createTurndownService, htmlToMarkdown } from "./convert/htmlToMarkdown";

// DOM Elements
const markdownEditor = document.getElementById("markdownEditor") as HTMLTextAreaElement;
const htmlPreview = document.getElementById("htmlPreview") as HTMLElement;
const container = document.getElementById("container") as HTMLElement;
const editorPane = document.getElementById("editorPane") as HTMLElement;
const previewPane = document.getElementById("previewPane") as HTMLElement;
const resizeHandle = document.getElementById("resizeHandle") as HTMLElement;
const autofixBtn = document.getElementById("autofixBtn") as HTMLButtonElement;
const copyHtmlBtn = document.getElementById("copyHtmlBtn") as HTMLButtonElement;
const copyMdBtn = document.getElementById("copyMdBtn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLElement;

// Setup split pane
setupSplitPane({
  container,
  leftPane: editorPane,
  rightPane: previewPane,
  handle: resizeHandle,
  minWidth: 250,
});

// Create render pipeline
const pipeline = createRenderPipeline({
  previewEl: htmlPreview,
  onRenderStart: () => {
    statusEl.textContent = "Rendering...";
    statusEl.className = "status rendering";
  },
  onRenderComplete: () => {
    statusEl.textContent = "";
    statusEl.className = "status";
  },
  onError: (error) => {
    statusEl.textContent = `Error: ${error.message}`;
    statusEl.className = "status";
  },
});

// Create turndown service for HTML to Markdown
const turndown = createTurndownService();

// Debounced render
let renderTimeout: number | null = null;
const DEBOUNCE_MS = 150;

function scheduleRender(): void {
  if (renderTimeout !== null) {
    window.clearTimeout(renderTimeout);
  }
  renderTimeout = window.setTimeout(() => {
    renderTimeout = null;
    pipeline.render(markdownEditor.value);
  }, DEBOUNCE_MS);
}

// Editor input handler
markdownEditor.addEventListener("input", scheduleRender);

// Autofix button
autofixBtn.addEventListener("click", () => {
  const current = markdownEditor.value;
  const { fixed, changed } = autofixMarkdownDiagrams(current);

  if (changed) {
    markdownEditor.value = fixed;
    scheduleRender();
    showButtonFeedback(autofixBtn, "Fixed!", "Autofix Diagrams");
  } else {
    showButtonFeedback(autofixBtn, "No changes", "Autofix Diagrams");
  }
});

// Copy HTML button
copyHtmlBtn.addEventListener("click", async () => {
  const html = pipeline.getExportHtml();
  const plainText = htmlPreview.innerText;

  const success = await copyHtmlFragment(html, plainText);
  if (success) {
    showButtonFeedback(copyHtmlBtn, "Copied!", "Copy HTML");
  } else {
    showButtonFeedback(copyHtmlBtn, "Failed", "Copy HTML");
  }
});

// Copy as Markdown button
copyMdBtn.addEventListener("click", async () => {
  const html = pipeline.getExportHtml();
  const md = htmlToMarkdown(html, turndown);

  const success = await copyText(md);
  if (success) {
    showButtonFeedback(copyMdBtn, "Copied!", "Copy as Markdown");
  } else {
    showButtonFeedback(copyMdBtn, "Failed", "Copy as Markdown");
  }
});

// Helper to show temporary button feedback
function showButtonFeedback(btn: HTMLButtonElement, message: string, original: string): void {
  btn.textContent = message;
  btn.classList.add("success");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("success");
  }, 1500);
}

// Restore saved content from localStorage
function restoreContent(): void {
  try {
    const saved = localStorage.getItem("markview-content");
    if (saved) {
      markdownEditor.value = saved;
    }
  } catch {
    // Ignore storage errors
  }
}

// Save content to localStorage
function saveContent(): void {
  try {
    localStorage.setItem("markview-content", markdownEditor.value);
  } catch {
    // Ignore storage errors
  }
}

// Save content periodically
let saveTimeout: number | null = null;
markdownEditor.addEventListener("input", () => {
  if (saveTimeout !== null) {
    window.clearTimeout(saveTimeout);
  }
  saveTimeout = window.setTimeout(saveContent, 1000);
});

// Default sample content
const SAMPLE_CONTENT = `# Welcome to markview

A markdown to HTML converter with diagram support.

## Features

- **Live preview** as you type
- **Diagram rendering**: Mermaid, Graphviz, WaveDrom, Vega-Lite
- **Math support**: Inline $E = mc^2$ and block math
- **Copy HTML** with embedded diagrams (no blob URLs)
- **Copy as Markdown** from the rendered HTML

## Example Diagrams

### Mermaid Flowchart

\`\`\`mermaid
flowchart LR
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\`\`\`

### Math

Block equation:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

---

Try editing this content or paste your own markdown!
`;

// Initialize
restoreContent();
if (!markdownEditor.value.trim()) {
  markdownEditor.value = SAMPLE_CONTENT;
}

// Initial render
pipeline.render(markdownEditor.value);
