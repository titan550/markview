/**
 * Analyze QR embedding parameters to find optimal settings.
 *
 * Run with: npx tsx scripts/analyze-qr-params.ts
 */

// Simulate the encoding pipeline to understand payload sizes

const BASE45_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

function base45Encode(bytes: Uint8Array): string {
  const result: string[] = [];
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      const n = bytes[i] * 256 + bytes[i + 1];
      result.push(BASE45_ALPHABET[n % 45]);
      result.push(BASE45_ALPHABET[Math.floor(n / 45) % 45]);
      result.push(BASE45_ALPHABET[Math.floor(n / 2025)]);
    } else {
      const n = bytes[i];
      result.push(BASE45_ALPHABET[n % 45]);
      result.push(BASE45_ALPHABET[Math.floor(n / 45)]);
    }
  }
  return result.join("");
}

// Simulate pako compression (approximate ratio for text)
function estimateCompressedSize(text: string): number {
  // Typical deflate compression ratio for code/markup is 3-5x
  // For very short strings, compression may not help much
  const rawSize = new TextEncoder().encode(text).length;
  if (rawSize < 50) return rawSize; // No compression benefit for tiny strings
  return Math.ceil(rawSize / 3.5); // ~3.5x compression for typical diagram code
}

// QR alphanumeric capacity per version and ECC level
const QR_CAPACITY: Record<string, number[]> = {
  L: [25, 47, 77, 114, 154, 195, 224, 279, 335, 395, 468, 535, 619, 667, 758, 854, 938, 1046, 1153, 1249],
  M: [20, 38, 61, 90, 122, 154, 178, 221, 262, 311, 366, 419, 483, 528, 600, 656, 734, 816, 909, 970],
  Q: [16, 29, 47, 67, 87, 108, 125, 157, 189, 221, 259, 296, 352, 376, 426, 470, 531, 574, 644, 702],
  H: [10, 20, 35, 50, 64, 84, 93, 122, 143, 174, 200, 227, 259, 283, 321, 365, 408, 452, 493, 557],
};

function getQrVersion(dataLength: number, ecc: string): number {
  const caps = QR_CAPACITY[ecc];
  for (let v = 1; v <= caps.length; v++) {
    if (caps[v - 1] >= dataLength) return v;
  }
  return -1; // Too large
}

function getModuleCount(version: number): number {
  return 17 + version * 4;
}

// Test diagrams of various sizes
const TEST_DIAGRAMS = [
  { name: "Tiny (A-->B)", lang: "mermaid", src: "A-->B" },
  { name: "Simple flowchart", lang: "mermaid", src: `flowchart LR
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E` },
  { name: "Medium sequence", lang: "mermaid", src: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    participant C as Charlie
    A->>B: Hello Bob
    B->>C: Hello Charlie
    C-->>B: Hi Bob
    B-->>A: Hi Alice
    A->>C: Direct message
    C-->>A: Reply` },
  { name: "Complex diagram", lang: "mermaid", src: `flowchart TD
    subgraph Frontend
        A[React App] --> B[Redux Store]
        B --> C[Components]
        C --> D[UI Elements]
    end
    subgraph Backend
        E[Express Server] --> F[Controllers]
        F --> G[Services]
        G --> H[Database]
    end
    A --> E
    E --> A
    H --> I[(PostgreSQL)]
    H --> J[(Redis Cache)]` },
  { name: "Large state diagram", lang: "mermaid", src: `stateDiagram-v2
    [*] --> Idle
    Idle --> Loading: fetch
    Loading --> Success: resolve
    Loading --> Error: reject
    Success --> Idle: reset
    Error --> Idle: reset
    Error --> Loading: retry

    state Success {
        [*] --> DataReady
        DataReady --> Processing
        Processing --> Complete
        Complete --> [*]
    }

    state Error {
        [*] --> NetworkError
        [*] --> ValidationError
        [*] --> ServerError
    }` },
];

console.log("=== QR Parameter Analysis ===\n");

console.log("Current parameters:");
console.log("  MIN_MODULE_PX = 3");
console.log("  MIN_QR_SIDE = 96px");
console.log("  MAX_QR_SIDE = 192px");
console.log("  QR_SIZE_RATIO = 22% of image width");
console.log("  MAX_CHUNKS = 4");
console.log("  ECC priority: Q → M → L");
console.log("");

console.log("=== Payload Size Analysis ===\n");

for (const diagram of TEST_DIAGRAMS) {
  const rawSize = new TextEncoder().encode(diagram.src).length;
  const compressedSize = estimateCompressedSize(diagram.src);

  // Envelope overhead: 12 bytes header + ~10 bytes TLV overhead
  const envelopeSize = compressedSize + 22;

  // Base45 encoding: 2 bytes → 3 chars
  const base45Size = Math.ceil(envelopeSize * 1.5);

  // Chunk header: "MV1/XXXXXXXX/1/1:" = 18 chars
  const chunkHeaderSize = 18;

  console.log(`${diagram.name}:`);
  console.log(`  Raw source: ${rawSize} bytes`);
  console.log(`  Compressed (est): ${compressedSize} bytes`);
  console.log(`  Envelope: ${envelopeSize} bytes`);
  console.log(`  Base45 encoded: ${base45Size} chars`);

  // Calculate chunks needed for different QR sizes
  for (const ecc of ["Q", "M", "L"]) {
    for (let chunks = 1; chunks <= 4; chunks++) {
      const chunkDataSize = Math.ceil(base45Size / chunks);
      const totalChunkSize = chunkDataSize + chunkHeaderSize;
      const version = getQrVersion(totalChunkSize, ecc);

      if (version > 0 && version <= 10) { // Practical limit
        const modules = getModuleCount(version);
        const minQrPx = modules * 3; // MIN_MODULE_PX = 3
        console.log(`  ECC ${ecc}, ${chunks} chunk(s): v${version} (${modules} modules, min ${minQrPx}px)`);
        break;
      }
    }
  }
  console.log("");
}

console.log("=== Image Width vs QR Size ===\n");

const widths = [400, 600, 800, 1000, 1200, 1600];
console.log("Image Width | Current (22%) | Min for 2 QRs | Min for 1 QR");
console.log("------------|---------------|---------------|-------------");

for (const w of widths) {
  const current = Math.max(96, Math.min(192, Math.round(w * 0.22)));
  // For 2 QRs: need ~200px each + 24px padding = ~424px → ~21% of width each
  const minFor2 = Math.round(w * 0.21);
  // For 1 QR: can use more space
  const minFor1 = Math.round(w * 0.25);
  console.log(`${w.toString().padStart(11)} | ${current.toString().padStart(13)}px | ${minFor2.toString().padStart(13)}px | ${minFor1.toString().padStart(11)}px`);
}

console.log("\n=== Recommendations ===\n");

console.log("1. COMPRESSION: Current deflate level 9 is good. Text compresses ~3-4x.");
console.log("");
console.log("2. QR SIZE (current 22% of width, 96-192px range):");
console.log("   - For simple diagrams: 1 QR at ~100px works well");
console.log("   - For complex diagrams: May need 2-4 QRs");
console.log("   - Consider: Increase MAX_QR_SIDE to 256px for larger images");
console.log("");
console.log("3. MIN_MODULE_PX = 3:");
console.log("   - Very aggressive - could fail on lower quality re-encodes");
console.log("   - Recommendation: Increase to 4 for better reliability");
console.log("   - This means larger QR codes, but more robust decoding");
console.log("");
console.log("4. CHUNK COUNT:");
console.log("   - Simple diagrams (<100 chars): 1 QR sufficient");
console.log("   - Medium diagrams (100-500 chars): 1-2 QRs");
console.log("   - Complex diagrams (500+ chars): 2-4 QRs");
console.log("");
console.log("5. ECC LEVEL:");
console.log("   - Current Q→M→L priority is good (tries more error correction first)");
console.log("   - For more reliability, could try Q only and accept larger QRs");
