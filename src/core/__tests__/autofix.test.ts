import { describe, it, expect } from "vitest";
import { autofixMarkdownDiagrams } from "../autofix";

describe("autofixMarkdownDiagrams", () => {
  describe("basic functionality", () => {
    it("returns unchanged for markdown without fences", () => {
      const md = "# Hello\n\nSome text";
      const result = autofixMarkdownDiagrams(md);
      expect(result.changed).toBe(false);
      expect(result.fixed).toBe(md);
    });

    it("returns unchanged for non-diagram fences", () => {
      const md = "```javascript\nconsole.log('hello');\n```";
      const result = autofixMarkdownDiagrams(md);
      expect(result.changed).toBe(false);
    });
  });

  describe("text normalization", () => {
    it("normalizes NBSP in mermaid diagrams", () => {
      const md = "```mermaid\nA\u00A0B\n```";
      const result = autofixMarkdownDiagrams(md);
      expect(result.changed).toBe(true);
      expect(result.fixed).toContain("A B");
    });

    it("normalizes smart quotes in mermaid diagrams", () => {
      const md = '```mermaid\nA["\u201CHello\u201D"]\n```';
      const result = autofixMarkdownDiagrams(md);
      expect(result.changed).toBe(true);
      expect(result.fixed).toContain('"Hello"');
    });

    it("normalizes NBSP in dot diagrams", () => {
      const md = "```dot\ndigraph\u00A0G {}\n```";
      const result = autofixMarkdownDiagrams(md);
      expect(result.changed).toBe(true);
      expect(result.fixed).toContain("digraph G");
    });

    it("normalizes NBSP in wavedrom diagrams", () => {
      const md = '```wavedrom\n{ "signal"\u00A0: [] }\n```';
      const result = autofixMarkdownDiagrams(md);
      expect(result.changed).toBe(true);
      expect(result.fixed).toContain('"signal" :');
    });

    it("normalizes NBSP in vega-lite diagrams", () => {
      const md = '```vega-lite\n{ "data"\u00A0: {} }\n```';
      const result = autofixMarkdownDiagrams(md);
      expect(result.changed).toBe(true);
      expect(result.fixed).toContain('"data" :');
    });
  });

  describe("fence preservation", () => {
    it("preserves fence markers (backticks)", () => {
      const md = "```mermaid\nA\u00A0B\n```";
      const result = autofixMarkdownDiagrams(md);
      expect(result.fixed).toMatch(/^``` mermaid\n/);
      expect(result.fixed).toMatch(/\n```$/);
    });

    it("preserves fence markers (tildes)", () => {
      const md = "~~~mermaid\nA\u00A0B\n~~~";
      const result = autofixMarkdownDiagrams(md);
      expect(result.fixed).toMatch(/^~~~ mermaid\n/);
      expect(result.fixed).toMatch(/\n~~~$/);
    });

    it("preserves indentation", () => {
      const md = "  ```mermaid\n  A\u00A0B\n  ```";
      const result = autofixMarkdownDiagrams(md);
      expect(result.fixed).toMatch(/^ {2}``` mermaid\n/);
    });
  });

  describe("multiple blocks", () => {
    it("fixes multiple diagram blocks", () => {
      const md = "```mermaid\nA\u00A0B\n```\n\nText\n\n```dot\nC\u00A0D\n```";
      const result = autofixMarkdownDiagrams(md);
      expect(result.changed).toBe(true);
      expect(result.fixed).toContain("A B");
      expect(result.fixed).toContain("C D");
    });

    it("preserves non-diagram blocks between diagrams", () => {
      const md = "```mermaid\nA\n```\n\n```javascript\ncode\n```\n\n```dot\nB\n```";
      const result = autofixMarkdownDiagrams(md);
      expect(result.fixed).toContain("```javascript\ncode\n```");
    });
  });

  describe("language aliases", () => {
    it("handles graphviz alias for dot", () => {
      const md = "```graphviz\nA\u00A0B\n```";
      const result = autofixMarkdownDiagrams(md);
      expect(result.changed).toBe(true);
    });

    it("handles gv alias for dot", () => {
      const md = "```gv\nA\u00A0B\n```";
      const result = autofixMarkdownDiagrams(md);
      expect(result.changed).toBe(true);
    });

    it("handles wave alias for wavedrom", () => {
      const md = "```wave\nA\u00A0B\n```";
      const result = autofixMarkdownDiagrams(md);
      expect(result.changed).toBe(true);
    });

    it("handles vl alias for vega-lite", () => {
      const md = "```vl\nA\u00A0B\n```";
      const result = autofixMarkdownDiagrams(md);
      expect(result.changed).toBe(true);
    });
  });
});
