import { describe, it, expect, vi } from "vitest";
import { isPng, extractMarkviewText, injectMarkviewITXt } from "../pngChunks";

// Minimal valid 1x1 white PNG (67 bytes)
// PNG signature + IHDR + IDAT + IEND
const MINIMAL_PNG = new Uint8Array([
  // PNG signature (8 bytes)
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  // IHDR chunk (25 bytes total: 4 length + 4 type + 13 data + 4 CRC)
  0x00,
  0x00,
  0x00,
  0x0d, // length = 13
  0x49,
  0x48,
  0x44,
  0x52, // type = "IHDR"
  0x00,
  0x00,
  0x00,
  0x01, // width = 1
  0x00,
  0x00,
  0x00,
  0x01, // height = 1
  0x08, // bit depth = 8
  0x02, // color type = 2 (RGB)
  0x00, // compression = 0
  0x00, // filter = 0
  0x00, // interlace = 0
  0x90,
  0x77,
  0x53,
  0xde, // CRC
  // IDAT chunk (22 bytes total: 4 length + 4 type + 10 data + 4 CRC)
  0x00,
  0x00,
  0x00,
  0x0a, // length = 10
  0x49,
  0x44,
  0x41,
  0x54, // type = "IDAT"
  0x78,
  0x9c,
  0x63,
  0xf8,
  0xff,
  0xff,
  0xff,
  0x00,
  0x05,
  0xfe, // compressed data
  0x02,
  0xfe,
  0xa5,
  0x61, // CRC
  // IEND chunk (12 bytes total: 4 length + 4 type + 0 data + 4 CRC)
  0x00,
  0x00,
  0x00,
  0x00, // length = 0
  0x49,
  0x45,
  0x4e,
  0x44, // type = "IEND"
  0xae,
  0x42,
  0x60,
  0x82, // CRC
]);

// Mock crc32 for tests
vi.mock("../markviewPayload", () => ({
  crc32: (data: Uint8Array) => {
    // Simple CRC-like hash for testing
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  },
}));

describe("pngChunks", () => {
  describe("isPng", () => {
    it("returns true for valid PNG", () => {
      expect(isPng(MINIMAL_PNG)).toBe(true);
    });

    it("returns false for empty data", () => {
      expect(isPng(new Uint8Array([]))).toBe(false);
    });

    it("returns false for non-PNG data", () => {
      expect(isPng(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toBe(false);
    });

    it("returns false for JPEG signature", () => {
      // JPEG starts with FFD8FF
      expect(isPng(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
    });

    it("returns false for partial PNG signature", () => {
      expect(isPng(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    });
  });

  describe("extractMarkviewText", () => {
    it("returns null for PNG without markview metadata", () => {
      const result = extractMarkviewText(MINIMAL_PNG);
      expect(result).toBeNull();
    });

    it("returns null for non-PNG data", () => {
      const result = extractMarkviewText(new Uint8Array([0x00]));
      expect(result).toBeNull();
    });
  });

  describe("injectMarkviewITXt", () => {
    it("throws for non-PNG data", () => {
      expect(() => {
        injectMarkviewITXt(new Uint8Array([0x00]), "test");
      }).toThrow("Not a valid PNG");
    });

    it("injects iTXt chunk before IEND", () => {
      const text = "MV1:testdata";
      const result = injectMarkviewITXt(MINIMAL_PNG, text);

      // Result should be larger than original
      expect(result.length).toBeGreaterThan(MINIMAL_PNG.length);

      // Result should still be valid PNG
      expect(isPng(result)).toBe(true);
    });

    it("produces PNG that ends with IEND", () => {
      const text = "MV1:testdata";
      const result = injectMarkviewITXt(MINIMAL_PNG, text);

      // Check last chunk is IEND
      const lastChunkType = String.fromCharCode(
        result[result.length - 8],
        result[result.length - 7],
        result[result.length - 6],
        result[result.length - 5]
      );
      expect(lastChunkType).toBe("IEND");
    });
  });

  describe("inject and extract round-trip", () => {
    it("round-trips metadata text", () => {
      const text = "MV1:SGVsbG8gV29ybGQh";
      const injected = injectMarkviewITXt(MINIMAL_PNG, text);
      const extracted = extractMarkviewText(injected);
      expect(extracted).toBe(text);
    });

    it("round-trips empty text", () => {
      const text = "";
      const injected = injectMarkviewITXt(MINIMAL_PNG, text);
      const extracted = extractMarkviewText(injected);
      expect(extracted).toBe(text);
    });

    it("round-trips text with special characters", () => {
      const text = "MV1:abc+/=123";
      const injected = injectMarkviewITXt(MINIMAL_PNG, text);
      const extracted = extractMarkviewText(injected);
      expect(extracted).toBe(text);
    });

    it("removes old markview chunks when injecting new one", () => {
      const text1 = "MV1:first";
      const text2 = "MV1:second";

      // Inject first
      const injected1 = injectMarkviewITXt(MINIMAL_PNG, text1);

      // Inject second (should replace first)
      const injected2 = injectMarkviewITXt(injected1, text2);

      // Extract should return second
      const extracted = extractMarkviewText(injected2);
      expect(extracted).toBe(text2);

      // Size should not grow unboundedly
      // Second injection should be similar size to first (old chunk removed)
      expect(Math.abs(injected1.length - injected2.length)).toBeLessThan(20);
    });
  });
});
