# Clipboard HTML copy failure path

Summary: HTML copy can fail without feedback when diagram image conversion rejects, leaving the copy action unresolved.

References:

- `src/main.ts:118` invokes `prepareHtmlForClipboard(...)` with no error handling before calling `copyHtmlFragment`.
- `src/ui/clipboard.ts:240` `prepareHtmlForClipboard` awaits `window.htmlToImage.toPng` or `FileReader` without a try/catch, so any rejection bubbles to the click handler.

Impact: A failed conversion (e.g., html-to-image error or FileReader rejection) can throw, preventing any copy feedback and risking an unhandled promise rejection.

Suggested fix: Wrap the conversion in a try/catch and fall back to raw HTML (or skip diagram rasterization) when it fails.
