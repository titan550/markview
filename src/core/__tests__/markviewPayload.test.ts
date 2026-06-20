import { describe, it, expect, beforeAll, vi } from "vitest";
import { crc32 } from "../markviewPayload";

// Mock pako for tests since it's normally a browser global
const mockPako = {
  deflateRaw: vi.fn((data: Uint8Array) => {
    // Simple pass-through for testing (no actual compression)
    // In reality, pako would compress the data
    return data;
  }),
  inflateRaw: vi.fn((data: Uint8Array) => {
    // Simple pass-through for testing (no actual decompression)
    return data;
  }),
};

beforeAll(() => {
  // @ts-expect-error - mocking window.pako
  global.window = { pako: mockPako };
});

describe("markviewPayload", () => {
  describe("crc32", () => {
    it("calculates CRC32 for empty data", () => {
      const data = new Uint8Array([]);
      const checksum = crc32(data);
      expect(checksum).toBe(0);
    });

    it("calculates CRC32 for known data", () => {
      // "123456789" -> CRC32 = 0xCBF43926
      const data = new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39]);
      const checksum = crc32(data);
      expect(checksum).toBe(0xcbf43926);
    });

    it("produces different checksums for different data", () => {
      const data1 = new Uint8Array([1, 2, 3]);
      const data2 = new Uint8Array([1, 2, 4]);
      const checksum1 = crc32(data1);
      const checksum2 = crc32(data2);
      expect(checksum1).not.toBe(checksum2);
    });

    it("produces same checksum for same data", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const checksum1 = crc32(data);
      const checksum2 = crc32(data);
      expect(checksum1).toBe(checksum2);
    });
  });

  describe("encodePayload and decodePayload", () => {
    // Import after mocking pako
    const getPayloadFns = async () => {
      const mod = await import("../markviewPayload");
      return { encodePayload: mod.encodePayload, decodePayload: mod.decodePayload };
    };

    it("round-trips simple payload", async () => {
      const { encodePayload, decodePayload } = await getPayloadFns();

      const original = { lang: "mermaid", src: "flowchart LR\n  A --> B" };
      const encoded = encodePayload(original);
      const decoded = decodePayload(encoded);

      expect(decoded).toEqual(original);
    });

    it("round-trips payload with Unicode", async () => {
      const { encodePayload, decodePayload } = await getPayloadFns();

      const original = { lang: "mermaid", src: "flowchart LR\n  A[Hello 世界] --> B[🌍]" };
      const encoded = encodePayload(original);
      const decoded = decodePayload(encoded);

      expect(decoded).toEqual(original);
    });

    it("returns null for tampered magic bytes", async () => {
      const { encodePayload, decodePayload } = await getPayloadFns();

      const original = { lang: "mermaid", src: "test" };
      const encoded = encodePayload(original);

      // Tamper with magic bytes
      encoded[0] = 0x00;

      const decoded = decodePayload(encoded);
      expect(decoded).toBeNull();
    });

    it("returns null for tampered version", async () => {
      const { encodePayload, decodePayload } = await getPayloadFns();

      const original = { lang: "mermaid", src: "test" };
      const encoded = encodePayload(original);

      // Tamper with version byte
      encoded[2] = 0x99;

      const decoded = decodePayload(encoded);
      expect(decoded).toBeNull();
    });

    it("returns null for truncated data", async () => {
      const { encodePayload, decodePayload } = await getPayloadFns();

      const original = { lang: "mermaid", src: "test" };
      const encoded = encodePayload(original);

      // Truncate
      const truncated = encoded.slice(0, 10);

      const decoded = decodePayload(truncated);
      expect(decoded).toBeNull();
    });

    it("returns null for empty data", async () => {
      const { decodePayload } = await getPayloadFns();

      const decoded = decodePayload(new Uint8Array([]));
      expect(decoded).toBeNull();
    });
  });
});
