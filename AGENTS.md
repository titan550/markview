# Repository Guidelines

## Project Structure & Module Organization

- `index.html` contains all HTML, CSS, and JavaScript for the app. This is a single-file client-side build that loads dependencies from CDNs.
- `test/` holds sample markdown used for manual verification (e.g., `test/map1.md`).
- `README.md` covers usage and the live demo link.

## Build, Test, and Development Commands

- No build step. Open `index.html` directly for quick checks.
- For features that require secure context (e.g., clipboard), serve locally:
  - `python3 -m http.server` then visit `http://localhost:8000`.
- There are no automated tests wired up at this time.

## Coding Style & Naming Conventions

- HTML/CSS/JS live in `index.html`; keep changes localized and readable.
- Indentation follows 2 spaces, and the codebase favors clear, descriptive names (`editorPanel`, `renderMermaidInsideMarkmap`).
- Use vanilla JavaScript and browser APIs; avoid introducing build tooling unless necessary.
- Keep strings and content ASCII unless the file already uses Unicode characters.

## Testing Guidelines

- Manual testing is expected.
- Use `test/map1.md` to stress Markmap + Mermaid rendering and node layout.
- Verify:
  - Paste flow works in the overlay and editor panel.
  - Mermaid diagrams render and do not clip.
  - Clipboard operations work when served over localhost.

## Commit & Pull Request Guidelines

- Commit messages are short and imperative, sometimes using a `feat:` prefix (e.g., `feat: add mermaid support`, `Add tests`).
- If you update UI/behavior, include a concise summary and a note about manual checks performed.
- For PRs, include:
  - A brief description of the change.
  - Screenshots or a short note of visual changes when UI is affected.

## Configuration & Dependencies

- External libraries are loaded via CDN (Markmap, D3, CodeMirror, Mermaid, Turndown). Keep versions pinned and update intentionally.
