import { describe, it, expect } from "vitest";
import { utf8ToBase64, base64ToUtf8, bytesToBase64, base64ToBytes } from "../base64utf8";

describe("base64utf8", () => {
  describe("utf8ToBase64 and base64ToUtf8", () => {
    it("round-trips ASCII text", () => {
      const original = "Hello, World!";
      const encoded = utf8ToBase64(original);
      const decoded = base64ToUtf8(encoded);
      expect(decoded).toBe(original);
    });

    it("round-trips Unicode text", () => {
      const original = "Hello, 世界! 🌍 مرحبا";
      const encoded = utf8ToBase64(original);
      const decoded = base64ToUtf8(encoded);
      expect(decoded).toBe(original);
    });

    it("round-trips emoji", () => {
      const original = "🎉🚀💡";
      const encoded = utf8ToBase64(original);
      const decoded = base64ToUtf8(encoded);
      expect(decoded).toBe(original);
    });

    it("round-trips empty string", () => {
      const original = "";
      const encoded = utf8ToBase64(original);
      const decoded = base64ToUtf8(encoded);
      expect(decoded).toBe(original);
    });

    it("round-trips multi-line text", () => {
      const original = "Line 1\nLine 2\nLine 3";
      const encoded = utf8ToBase64(original);
      const decoded = base64ToUtf8(encoded);
      expect(decoded).toBe(original);
    });

    it("round-trips special characters", () => {
      const original = "Special: <>&\"'`\\n\\t";
      const encoded = utf8ToBase64(original);
      const decoded = base64ToUtf8(encoded);
      expect(decoded).toBe(original);
    });

    it("round-trips diagram source with Persian text", () => {
      const original = `flowchart LR
    A[شروع] --> B{تصمیم}
    B -->|بله| C[عمل ۱]
    B -->|خیر| D[عمل ۲]`;
      const encoded = utf8ToBase64(original);
      const decoded = base64ToUtf8(encoded);
      expect(decoded).toBe(original);
    });
  });

  describe("bytesToBase64 and base64ToBytes", () => {
    it("round-trips byte array", () => {
      const original = new Uint8Array([0, 1, 2, 255, 254, 128]);
      const encoded = bytesToBase64(original);
      const decoded = base64ToBytes(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(original));
    });

    it("round-trips empty array", () => {
      const original = new Uint8Array([]);
      const encoded = bytesToBase64(original);
      const decoded = base64ToBytes(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(original));
    });

    it("round-trips large array", () => {
      const original = new Uint8Array(10000);
      for (let i = 0; i < original.length; i++) {
        original[i] = i % 256;
      }
      const encoded = bytesToBase64(original);
      const decoded = base64ToBytes(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(original));
    });
  });
});
