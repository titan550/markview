# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

markview is a client-side, single-page Markdown → HTML preview app (Vite + vanilla TypeScript, no framework). Its distinguishing feature is **round-trip diagram preservation**: diagrams render to images for export, but the original source is embedded in the image so pasting it back recovers editable fences.

> Note: `AGENTS.md` is **stale** — it describes an older single-`index.html` CDN app with no build step. Ignore it; this file and the actual `src/` tree are the source of truth.

## Commands

```bash
npm run dev            # Vite dev server (also how Playwright boots the app, on :4173)
npm run build          # tsc --noEmit (typecheck) THEN vite build — typecheck failures break the build
npm run lint           # eslint .
npm run format         # prettier --write .   (check-only: npm run format:check)
npm test               # vitest run (unit tests, happy-dom env)
npm run test:coverage  # vitest with v8 coverage (scoped to core/render/convert/ui)
npm run test:e2e       # playwright (chromium + webkit)
```

Running a single test:

```bash
npx vitest run src/core/__tests__/pngChunks.test.ts   # one unit file
npx vitest run -t "crc32"                              # by test name
npx playwright test e2e/copy.spec.ts -g "QR embed"     # one e2e by file + name
```

**Git hooks (husky) enforce CI locally:** pre-commit runs `lint-staged`; **pre-push runs `format:check`, `lint`, `test`, and `build` — all must pass to push.** Run these before assuming work is done.

## Architecture

### Vendor libraries are CDN globals, not imports

Heavy dependencies (markdown-it, Turndown, DOMPurify, Mermaid, Viz/Graphviz, WaveDrom, Vega, MathJax, pako, qrcode-generator, jsQR, html-to-image) are loaded via `<script>` tags in `index.html` and accessed as `window.*`. They are typed in `src/types/vendors.ts` + `src/types/vendor-globals.d.ts`.

Consequences:

- Every use guards availability (`if (!window.pako) ...`) and degrades gracefully.
- In **vitest (happy-dom)** these globals don't exist, so unit-tested `core/` functions either avoid them or are tested only along paths that don't need them. Don't write unit tests that assume `window.mermaid` etc.

### The render pipeline (`src/render/pipeline.ts`)

markdown-it is synchronous but diagram/math rendering is async, so rendering uses a **placeholder-and-hydrate** strategy:

1. `parseMarkdown` (`src/convert/markdownToHtml.ts`) extracts fenced diagrams and `$…$`/`$$…$$` math **before** markdown-it sees them, replacing each with a 1×1 GIF `<img>` placeholder whose `alt` encodes type+id (`diagram:0`, `math-block:1`). Placeholder helpers live in `src/core/placeholders.ts`.
2. markdown-it renders the rest (`html: false` — raw HTML disabled for security).
3. Output is DOMPurify-sanitized and inserted into the preview.
4. Placeholder `<img>`s are found by `alt` and replaced with async-rendered nodes (`renderDiagramToEmbeddedNode`, `renderMathToEmbeddedNode`).
5. Prism highlights code.

A **stale-render guard** (`pending` token counter + `shouldContinue()`) aborts superseded renders; input is debounced 150ms in `main.ts`. Math extraction (`extractMath`) hand-scans the text to skip code fences/inline code and ignores currency-like `$…$` via `shouldRenderInlineMath`.

### Diagram renderers are a registry (`src/renderers/`)

Each renderer implements `Renderer` from `src/renderers/types.ts` (`{ name, render(src, ctx) => RenderResult }`). They're registered in two maps in `src/render/diagrams.ts`: `renderers` (lang → renderer) and `canonicalLang` (alias → canonical, e.g. `gv`→`dot`). Supported: mermaid, dot/graphviz/gv, wavedrom/wave/wavejson, vega-lite/vl.

**To add a diagram type:** implement the interface in `src/renderers/`, add it to both maps, and add the lang to the shared `DIAGRAM_LANGS` set in `src/core/diagramLangs.ts` (used by both the parser and the autofixer).

Rendered output is a `<figure class="diagram diagram-{lang}">` carrying `data-diagram` (canonical lang) and `data-source-base64` (original source). **These two attributes are the anchor for the entire round-trip system below.**

### Round-trip source preservation (the core differentiator)

Diagram source survives export so it can be recovered on paste, through two redundant channels:

- **Binary envelope** (`src/core/markviewPayload.ts`): `encodePayload`/`decodePayload` produce a self-describing blob — magic `MV`, version, deflate-raw (pako, level 9), CRC32, and a TLV body of `{lang, src}`. This is the unit that gets embedded and recovered.
- **PNG `iTXt` metadata** (`src/core/pngChunks.ts`): injects an `iTXt` chunk (keyword `markview`, value `MV1:<base64(envelope)>`) before `IEND`. Fast path; survives most copies.
- **QR footer fallback** (`src/core/qrEmbed.ts`): when metadata is stripped (e.g. email clients), the envelope is base45-encoded, split into ≤4 chunks, and rendered as small QR codes composited into a footer strip below the diagram. Decoding scans footer/grid/full-image regions and reassembles chunks by msgid. QR sizing params were tuned empirically (see `scripts/`).

Flow across files:

- **Export** — `prepareHtmlForClipboard` (`src/ui/clipboard.ts`): rasterizes each live `figure.diagram` to PNG (html-to-image, SVG-canvas fallback), reads `data-source-base64`, embeds via iTXt (+ optional QR), and swaps the figure for an `<img>`. Toggled by the "Embed source" / "QR fallback" checkboxes (persisted in localStorage).
- **HTML → Markdown** — `src/convert/htmlToMarkdown.ts`: Turndown with custom rules that turn `data-diagram`/`data-source-base64` back into fenced code and `data-tex`/`data-math-mode` back into math.
- **Paste recovery** — `src/convert/clipboardPaste.ts`: the paste handler in `main.ts` **synchronously** snapshots the clipboard (`extractClipboardData`) before any `await` (clipboard data is gone after the first await), then asynchronously recovers source from images in priority order: existing data-attrs → PNG iTXt → QR scan.

### Source layout

- `src/core/` — pure-ish utilities: payload envelope, PNG chunks, QR embed, base64/utf8, fence scanner (`fences.ts`), placeholders, SVG utils + sanitizers, text/autofix. Most unit tests live in `src/core/__tests__/`.
- `src/convert/` — markdown↔HTML and clipboard-paste recovery.
- `src/render/` — the pipeline plus diagram/math hydration to DOM nodes.
- `src/renderers/` — one file per diagram language.
- `src/ui/` — clipboard export, split-pane resizer.
- `src/types/` — vendor global declarations.
- `scripts/` — standalone QR-parameter search experiments; **not part of the build**.
- `e2e/`, `TODO.md`, `bugs/` — Playwright specs, wishlist, known-issue notes.

## Conventions & gotchas

- **Editor state** persists to `localStorage` (`markview-content`, `markview-embed-*`); a sample doc loads only when empty.
- **E2E test hooks:** `main.ts` exposes `window.__test_*` (encode/decode payload, QR plan/composite/decode) so Playwright can exercise the QR round-trip in-browser. Keep these in sync if you rename those functions.
- There are **leftover `console.log` debug statements** throughout the paste/QR/clipboard path (e.g. `=== PASTE DEBUG ===`). They're currently intentional for diagnosing clipboard issues across apps; don't be surprised by them, and clean up rather than add more.
- **Prettier:** double quotes, `printWidth: 100`, `trailingComma: "es5"`. ESLint allows `any` and ignores unused args prefixed `_`.
- **tsconfig is strict** with `noEmit`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax` (use `import type` for type-only imports) and `allowImportingTsExtensions`.
- **Deployment:** `vite.config.ts` derives `base` from `GITHUB_REPOSITORY` for GitHub Pages; override with `BASE_PATH`.
