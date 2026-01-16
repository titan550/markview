import { describe, it, expect, beforeEach, vi } from "vitest";
import { shouldRenderInlineMath, parseMarkdown } from "../markdownToHtml";

describe("shouldRenderInlineMath", () => {
  describe("filters currency patterns", () => {
    it("rejects plain numbers", () => {
      expect(shouldRenderInlineMath("100")).toBe(false);
    });

    it("rejects formatted numbers", () => {
      expect(shouldRenderInlineMath("1,000")).toBe(false);
    });

    it("rejects numbers with decimals", () => {
      expect(shouldRenderInlineMath("99.99")).toBe(false);
    });

    it("rejects numbers with magnitude suffixes", () => {
      expect(shouldRenderInlineMath("5k")).toBe(false);
      expect(shouldRenderInlineMath("2.5m")).toBe(false);
      expect(shouldRenderInlineMath("1bn")).toBe(false);
    });

    it("rejects price ranges", () => {
      expect(shouldRenderInlineMath("10-20")).toBe(false);
      expect(shouldRenderInlineMath("100 to 200")).toBe(false);
    });
  });

  describe("accepts math expressions", () => {
    it("accepts expressions with backslash", () => {
      expect(shouldRenderInlineMath("\\pi")).toBe(true);
      expect(shouldRenderInlineMath("\\frac{1}{2}")).toBe(true);
    });

    it("accepts expressions with caret (superscript)", () => {
      expect(shouldRenderInlineMath("x^2")).toBe(true);
      expect(shouldRenderInlineMath("e^{i\\pi}")).toBe(true);
    });

    it("accepts expressions with underscore (subscript)", () => {
      expect(shouldRenderInlineMath("x_1")).toBe(true);
      expect(shouldRenderInlineMath("a_{ij}")).toBe(true);
    });

    it("accepts expressions with braces", () => {
      expect(shouldRenderInlineMath("{x}")).toBe(true);
    });

    it("accepts expressions with equals", () => {
      expect(shouldRenderInlineMath("E = mc^2")).toBe(true);
    });

    it("accepts single letters (variables)", () => {
      expect(shouldRenderInlineMath("x")).toBe(true);
      expect(shouldRenderInlineMath("A")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("rejects empty string", () => {
      expect(shouldRenderInlineMath("")).toBe(false);
    });

    it("rejects whitespace only", () => {
      expect(shouldRenderInlineMath("   ")).toBe(false);
    });

    it("handles null/undefined gracefully", () => {
      expect(shouldRenderInlineMath(null as unknown as string)).toBe(false);
      expect(shouldRenderInlineMath(undefined as unknown as string)).toBe(false);
    });
  });
});

describe("parseMarkdown", () => {
  beforeEach(() => {
    // Mock markdown-it
    const mockMdit = {
      render: (text: string) => `<p>${text}</p>`,
    };
    vi.stubGlobal("markdownit", () => mockMdit);
  });

  describe("diagram extraction", () => {
    it("extracts mermaid diagrams", () => {
      const md = "# Title\n\n```mermaid\nA --> B\n```";
      const result = parseMarkdown(md);
      expect(result.diagrams).toHaveLength(1);
      expect(result.diagrams[0].lang).toBe("mermaid");
      expect(result.diagrams[0].content).toBe("A --> B");
    });

    it("extracts dot diagrams", () => {
      const md = "```dot\ndigraph G {}\n```";
      const result = parseMarkdown(md);
      expect(result.diagrams).toHaveLength(1);
      expect(result.diagrams[0].lang).toBe("dot");
    });

    it("extracts wavedrom diagrams", () => {
      const md = '```wavedrom\n{"signal":[]}\n```';
      const result = parseMarkdown(md);
      expect(result.diagrams).toHaveLength(1);
      expect(result.diagrams[0].lang).toBe("wavedrom");
    });

    it("extracts vega-lite diagrams", () => {
      const md = '```vega-lite\n{"data":{}}\n```';
      const result = parseMarkdown(md);
      expect(result.diagrams).toHaveLength(1);
      expect(result.diagrams[0].lang).toBe("vega-lite");
    });

    it("does not extract non-diagram code blocks", () => {
      const md = "```javascript\nconsole.log('hello');\n```";
      const result = parseMarkdown(md);
      expect(result.diagrams).toHaveLength(0);
    });

    it("handles multiple diagrams", () => {
      const md = "```mermaid\nA\n```\n\n```dot\nB\n```";
      const result = parseMarkdown(md);
      expect(result.diagrams).toHaveLength(2);
    });
  });

  describe("math extraction", () => {
    it("extracts inline math", () => {
      const md = "The equation $E = mc^2$ is famous.";
      const result = parseMarkdown(md);
      expect(result.math).toHaveLength(1);
      expect(result.math[0].mode).toBe("inline");
      expect(result.math[0].tex).toBe("E = mc^2");
    });

    it("extracts block math", () => {
      const md = "$$\n\\int_0^1 x dx\n$$";
      const result = parseMarkdown(md);
      expect(result.math).toHaveLength(1);
      expect(result.math[0].mode).toBe("block");
      expect(result.math[0].tex).toBe("\\int_0^1 x dx");
    });

    it("handles multiple math expressions", () => {
      const md = "Inline $a$ and $b$ and block $$c$$";
      const result = parseMarkdown(md);
      expect(result.math).toHaveLength(3);
    });

    it("skips math inside code fences", () => {
      const md = "```\n$not math$\n```";
      const result = parseMarkdown(md);
      expect(result.math).toHaveLength(0);
    });

    it("skips math inside inline code", () => {
      const md = "Use `$var` for variables";
      const result = parseMarkdown(md);
      expect(result.math).toHaveLength(0);
    });

    it("does not extract number-only expressions", () => {
      // Number-only expressions like $100$ are not rendered as math
      const md = "The value $100$ is constant";
      const result = parseMarkdown(md);
      // $100$ is not extracted because shouldRenderInlineMath("100") is false
      expect(result.math).toHaveLength(0);
    });
  });

  describe("placeholder replacement", () => {
    it("replaces diagrams with placeholders in HTML", () => {
      const md = "```mermaid\nA --> B\n```";
      const result = parseMarkdown(md);
      expect(result.html).toContain("diagram:0");
    });

    it("replaces math with placeholders in HTML", () => {
      const md = "Formula: $x^2$";
      const result = parseMarkdown(md);
      expect(result.html).toContain("math-inline:0");
    });
  });
});
