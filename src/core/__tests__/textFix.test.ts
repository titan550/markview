import { describe, it, expect } from "vitest";
import { normalizeSpaces, normalizeSmartQuotes, normalizeText } from "../textFix";

describe("normalizeSpaces", () => {
  it("converts NBSP to regular space", () => {
    expect(normalizeSpaces("hello\u00A0world")).toBe("hello world");
  });

  it("converts &nbsp; to regular space", () => {
    expect(normalizeSpaces("hello&nbsp;world")).toBe("hello world");
  });

  it("removes zero-width space", () => {
    expect(normalizeSpaces("hello\u200Bworld")).toBe("helloworld");
  });

  it("removes BOM", () => {
    expect(normalizeSpaces("\uFEFFhello")).toBe("hello");
  });
});

describe("normalizeSmartQuotes", () => {
  it("converts curly double quotes to straight", () => {
    expect(normalizeSmartQuotes("\u201Chello\u201D")).toBe('"hello"');
  });

  it("converts curly single quotes to straight", () => {
    expect(normalizeSmartQuotes("\u2018hello\u2019")).toBe("'hello'");
  });
});

describe("normalizeText", () => {
  it("applies both space and quote normalization", () => {
    expect(normalizeText("\u201Chello\u00A0world\u201D")).toBe('"hello world"');
  });
});
