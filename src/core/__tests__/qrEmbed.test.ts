import { describe, it, expect } from "vitest";
import { base45Encode, base45Decode, parseChunkString } from "../qrEmbed";
import type { QrChunk } from "../qrEmbed";

describe("qrEmbed", () => {
  describe("base45Encode/base45Decode", () => {
    it("round-trips empty array", () => {
      const input = new Uint8Array([]);
      const encoded = base45Encode(input);
      const decoded = base45Decode(encoded);
      expect(decoded).toEqual(input);
    });

    it("round-trips single byte", () => {
      const input = new Uint8Array([42]);
      const encoded = base45Encode(input);
      const decoded = base45Decode(encoded);
      expect(decoded).toEqual(input);
    });

    it("round-trips two bytes", () => {
      const input = new Uint8Array([0, 255]);
      const encoded = base45Encode(input);
      const decoded = base45Decode(encoded);
      expect(decoded).toEqual(input);
    });

    it("round-trips longer data", () => {
      const input = new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]); // "Hello World"
      const encoded = base45Encode(input);
      const decoded = base45Decode(encoded);
      expect(decoded).toEqual(input);
    });

    it("round-trips binary data with all byte values", () => {
      const input = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        input[i] = i;
      }
      const encoded = base45Encode(input);
      const decoded = base45Decode(encoded);
      expect(decoded).toEqual(input);
    });

    it("produces only alphanumeric characters", () => {
      const input = new Uint8Array([0, 128, 255, 1, 254]);
      const encoded = base45Encode(input);
      // Base45 alphabet: 0-9, A-Z, space, $, %, *, +, -, ., /, :
      expect(encoded).toMatch(/^[0-9A-Z $%*+\-./:]*$/);
    });

    it("returns null for invalid base45 characters", () => {
      const result = base45Decode("abc!@#"); // lowercase and invalid chars
      expect(result).toBeNull();
    });

    it("returns null for invalid length (1 char)", () => {
      const result = base45Decode("A");
      expect(result).toBeNull();
    });
  });

  describe("parseChunkString", () => {
    it("parses valid chunk string", () => {
      const result = parseChunkString("MV1/ABCD1234/1/2:SOMEDATA");
      expect(result).toEqual({
        msgid: "ABCD1234",
        index: 1,
        total: 2,
        data: "SOMEDATA",
      } as QrChunk);
    });

    it("parses chunk with index equal to total", () => {
      const result = parseChunkString("MV1/12345678/4/4:DATA");
      expect(result).toEqual({
        msgid: "12345678",
        index: 4,
        total: 4,
        data: "DATA",
      } as QrChunk);
    });

    it("returns null for invalid prefix", () => {
      expect(parseChunkString("MV2/ABCD1234/1/2:DATA")).toBeNull();
      expect(parseChunkString("XX1/ABCD1234/1/2:DATA")).toBeNull();
    });

    it("returns null for invalid msgid length", () => {
      expect(parseChunkString("MV1/ABCD123/1/2:DATA")).toBeNull(); // 7 chars
      expect(parseChunkString("MV1/ABCD12345/1/2:DATA")).toBeNull(); // 9 chars
    });

    it("returns null for invalid msgid characters", () => {
      expect(parseChunkString("MV1/abcd1234/1/2:DATA")).toBeNull(); // lowercase
      expect(parseChunkString("MV1/ABCD123G/1/2:DATA")).toBeNull(); // G not hex
    });

    it("returns null for index > total", () => {
      expect(parseChunkString("MV1/ABCD1234/3/2:DATA")).toBeNull();
    });

    it("returns null for index < 1", () => {
      expect(parseChunkString("MV1/ABCD1234/0/2:DATA")).toBeNull();
    });

    it("returns null for total > 4", () => {
      expect(parseChunkString("MV1/ABCD1234/1/5:DATA")).toBeNull();
    });

    it("returns null for missing data", () => {
      expect(parseChunkString("MV1/ABCD1234/1/2:")).toBeNull();
    });

    it("handles data with special characters", () => {
      const result = parseChunkString("MV1/ABCD1234/1/1:ABC+DEF/GHI:JKL");
      expect(result).toEqual({
        msgid: "ABCD1234",
        index: 1,
        total: 1,
        data: "ABC+DEF/GHI:JKL",
      } as QrChunk);
    });
  });
});
