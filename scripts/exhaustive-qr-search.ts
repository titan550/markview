#!/usr/bin/env npx tsx
/**
 * RIGOROUS QR Parameter Space Search (Memory-Optimized)
 *
 * Uses REAL JPEG encode/decode cycles, proper statistics, and tests
 * the actual degradation chains that occur in Word/Pages.
 *
 * Memory-optimized: streams results to file, processes in batches.
 * Target: <4GB memory usage.
 *
 * Run: npx tsx scripts/exhaustive-qr-search.ts
 */

import { createCanvas, loadImage, Canvas } from "canvas";
import * as fs from "fs";
import * as readline from "readline";
// @ts-ignore
import jsQR from "jsqr";
// @ts-ignore
import QRCode from "qrcode";

// ============================================================================
// CONFIGURATION - Word-focused exhaustive search (bounded + pruned)
// ============================================================================

const CONFIG = {
  // QR sizes (pixels) - exhaustive but bounded
  sizes: range(48, 320, 8),

  // Representative output dimensions for image size heuristic
  imageWidthPx: 1200,
  imageHeightPx: 800,

  // Data lengths (chars) - target up to 1200 chars payload
  dataLengths: range(50, 1200, 25),

  // ECC levels - prioritize M, then L, then Q
  eccLevels: ["M", "L", "Q"] as const,

  // JPEG quality (Word target) - 100 treated as best-case
  jpegQualities: range(60, 100, 5).reverse(),

  // Scale factors (resize down then up - simulates DPI changes)
  scaleFactors: range(0.6, 1.0, 0.05).reverse(),

  // Re-encode cycles (simulates copy-paste chains)
  reEncodeCycles: [0, 1, 2, 3],

  // Trials per combination - tiered for efficiency
  trialsPerCombo: 3,
  trialsPerComboMax: 10,
  tier2Threshold: 0.66,

  // Confidence level for intervals
  confidenceLevel: 0.95,

  // Module size constraints
  minModulePx: 2.2,
  quietZoneModules: 4,

  // Image size cap (heuristic)
  maxImageBytes: 5 * 1024 * 1024,
  qrPaddingPx: 8,

  // Batch size for memory cleanup
  batchSize: 200,

  // Output file
  outputFile: "qr-search-results.jsonl",
};

// ============================================================================
// UTILITIES
// ============================================================================

function range(start: number, end: number, step: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= end + 1e-6; value += step) {
    const rounded = Math.round(value * 100) / 100;
    values.push(rounded);
  }
  return values;
}

// ============================================================================
// TYPES
// ============================================================================

interface TestResult {
  size: number;
  dataLen: number;
  ecc: string;
  jpegQuality: number;
  scale: number;
  reEncodeCycles: number;
  moduleCount: number;
  modulePx: number;
  successCount: number;
  trials: number;
  successRate: number;
  ci95Lower: number;
  ci95Upper: number;
  skippedReason?: string;
}

// ============================================================================
// STATISTICS
// ============================================================================

function wilsonScoreInterval(
  successes: number,
  trials: number,
  confidence: number
): [number, number] {
  if (trials === 0) return [0, 0];

  const z = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
  const p = successes / trials;
  const n = trials;

  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));

  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

// ============================================================================
// QR CODE GENERATION
// ============================================================================

async function generateQR(
  data: string,
  size: number,
  ecc: string
): Promise<{
  canvas: Canvas;
  moduleCount: number;
  modulePx: number;
} | null> {
  try {
    const qr = await QRCode.create(data, {
      errorCorrectionLevel: ecc as "L" | "M" | "Q" | "H",
      mode: "alphanumeric",
    });

    const moduleCount = qr.modules.size;
    const quietZone = CONFIG.quietZoneModules;
    const totalModules = moduleCount + quietZone * 2;
    const modulePx = size / totalModules;

    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = "#000000";
    const offset = quietZone * modulePx;

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.modules.get(row, col)) {
          const x = Math.floor(offset + col * modulePx);
          const y = Math.floor(offset + row * modulePx);
          const w = Math.ceil(modulePx);
          const h = Math.ceil(modulePx);
          ctx.fillRect(x, y, w, h);
        }
      }
    }

    return { canvas, moduleCount, modulePx };
  } catch {
    return null;
  }
}

// ============================================================================
// PRUNING HEURISTICS
// ============================================================================

const COMPRESSION_RATIOS: Array<{ minQuality: number; ratio: number }> = [
  { minQuality: 95, ratio: 3 },
  { minQuality: 85, ratio: 4 },
  { minQuality: 75, ratio: 6 },
  { minQuality: 65, ratio: 8 },
  { minQuality: 0, ratio: 10 },
];

function estimateImageBytes(
  width: number,
  height: number,
  quality: number,
  footerHeight: number
): number {
  const pixels = width * (height + footerHeight);
  const ratio = COMPRESSION_RATIOS.find((entry) => quality >= entry.minQuality)?.ratio ?? 10;
  return Math.round((pixels * 3) / ratio);
}

function estimateQrModuleCount(dataLength: number, ecc: string): number {
  const capacities: Record<string, number[]> = {
    L: [
      25, 47, 77, 114, 154, 195, 224, 279, 335, 395, 468, 535, 619, 667, 758, 854, 938, 1046, 1153,
      1249, 1352, 1460, 1588, 1704, 1853, 1990, 2132, 2223, 2369, 2520, 2677, 2840, 3009, 3183,
      3351, 3537, 3729, 3927, 4087, 4296,
    ],
    M: [
      20, 38, 61, 90, 122, 154, 178, 221, 262, 311, 366, 419, 483, 528, 600, 656, 734, 816, 909,
      970, 1035, 1134, 1248, 1326, 1451, 1542, 1637, 1732, 1839, 1994, 2113, 2238, 2369, 2506, 2632,
      2780, 2894, 3054, 3220, 3391,
    ],
    Q: [
      16, 29, 47, 67, 87, 108, 125, 157, 189, 221, 259, 296, 352, 376, 426, 470, 531, 574, 644, 702,
      742, 823, 890, 963, 1041, 1094, 1172, 1263, 1322, 1429, 1499, 1618, 1700, 1787, 1867, 1966,
      2071, 2181, 2298, 2420,
    ],
  };

  const list = capacities[ecc];
  if (!list) return -1;
  for (let version = 1; version <= list.length; version++) {
    if (list[version - 1] >= dataLength) {
      return 17 + version * 4;
    }
  }
  return -1;
}

function shouldSkipCombo(
  dataLength: number,
  size: number,
  ecc: string,
  quality: number
): { skip: boolean; reason?: string; moduleCount?: number; modulePx?: number } {
  const moduleCount = estimateQrModuleCount(dataLength, ecc);
  if (moduleCount < 0) {
    return { skip: true, reason: "capacity", moduleCount, modulePx: 0 };
  }

  const totalModules = moduleCount + CONFIG.quietZoneModules * 2;
  const modulePx = size / totalModules;
  if (modulePx < CONFIG.minModulePx) {
    return { skip: true, reason: "modulePx", moduleCount, modulePx };
  }

  const footerHeight = size + CONFIG.qrPaddingPx * 2;
  const estimatedBytes = estimateImageBytes(
    CONFIG.imageWidthPx,
    CONFIG.imageHeightPx,
    quality,
    footerHeight
  );
  if (estimatedBytes > CONFIG.maxImageBytes) {
    return { skip: true, reason: "imageSize", moduleCount, modulePx };
  }

  return { skip: false, moduleCount, modulePx };
}

// ============================================================================
// REAL DEGRADATION
// ============================================================================

async function applyRealJpegCompression(canvas: Canvas, quality: number): Promise<Canvas> {
  if (quality >= 100) return canvas;

  const jpegBuffer = canvas.toBuffer("image/jpeg", { quality: quality / 100 });
  const img = await loadImage(jpegBuffer);

  const result = createCanvas(canvas.width, canvas.height);
  const ctx = result.getContext("2d");
  ctx.drawImage(img, 0, 0);

  return result;
}

async function applyScaling(canvas: Canvas, scale: number): Promise<Canvas> {
  if (scale >= 1.0) return canvas;

  const smallWidth = Math.round(canvas.width * scale);
  const smallHeight = Math.round(canvas.height * scale);

  const small = createCanvas(smallWidth, smallHeight);
  const ctxSmall = small.getContext("2d");
  ctxSmall.drawImage(canvas, 0, 0, smallWidth, smallHeight);

  const restored = createCanvas(canvas.width, canvas.height);
  const ctxRestored = restored.getContext("2d");
  ctxRestored.drawImage(small, 0, 0, canvas.width, canvas.height);

  return restored;
}

async function applyDegradationChain(
  canvas: Canvas,
  params: { jpegQuality: number; scale: number; reEncodeCycles: number }
): Promise<Canvas> {
  let result = canvas;

  result = await applyScaling(result, params.scale);

  const cycleQuality = Math.max(params.jpegQuality, 70);

  for (let cycle = 0; cycle <= params.reEncodeCycles; cycle++) {
    if (cycle === 0) {
      result = await applyRealJpegCompression(result, params.jpegQuality);
    } else {
      result = await applyRealJpegCompression(result, cycleQuality);
    }
  }

  return result;
}

// ============================================================================
// QR DECODING
// ============================================================================

function tryDecode(canvas: Canvas, expectedData: string): boolean {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  for (const inversionAttempts of ["dontInvert", "attemptBoth"] as const) {
    try {
      const result = jsQR(new Uint8ClampedArray(imageData.data), canvas.width, canvas.height, {
        inversionAttempts,
      });

      if (result && result.data === expectedData) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

// ============================================================================
// TEST DATA GENERATION
// ============================================================================

function generateTestData(length: number, seed: number): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
  let result = "MV1/";

  let rng = seed;
  const nextRng = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng;
  };

  for (let i = 0; i < 8; i++) {
    result += "0123456789ABCDEF"[nextRng() % 16];
  }
  result += "/1/1:";

  while (result.length < length) {
    result += chars[nextRng() % chars.length];
  }

  return result.substring(0, length);
}

// ============================================================================
// MAIN SEARCH (Memory-Optimized)
// ============================================================================

async function runExhaustiveSearch(): Promise<number> {
  console.log("🔬 RIGOROUS QR PARAMETER SPACE SEARCH (Memory-Optimized)");
  console.log("═".repeat(70));

  const totalCombos =
    CONFIG.sizes.length *
    CONFIG.dataLengths.length *
    CONFIG.eccLevels.length *
    CONFIG.jpegQualities.length *
    CONFIG.scaleFactors.length *
    CONFIG.reEncodeCycles.length;
  const totalTrials = totalCombos * CONFIG.trialsPerCombo;

  console.log(`\n📋 Configuration:`);
  console.log(`   Sizes: ${CONFIG.sizes.join(", ")}px`);
  console.log(`   Data lengths: ${CONFIG.dataLengths.join(", ")} chars`);
  console.log(`   ECC levels: ${CONFIG.eccLevels.join(", ")}`);
  console.log(`   JPEG qualities: ${CONFIG.jpegQualities.join(", ")}`);
  console.log(`   Scale factors: ${CONFIG.scaleFactors.join(", ")}`);
  console.log(`   Re-encode cycles: ${CONFIG.reEncodeCycles.join(", ")}`);
  console.log(`   Trials per combo: ${CONFIG.trialsPerCombo}`);
  console.log(`   Max trials per combo: ${CONFIG.trialsPerComboMax}`);
  console.log(`   Tier2 threshold: ${CONFIG.tier2Threshold}`);
  console.log(`   Min module px: ${CONFIG.minModulePx}`);
  console.log(`   Max image bytes: ${(CONFIG.maxImageBytes / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   Total combinations: ${totalCombos.toLocaleString()}`);
  console.log(`   Total trials (baseline): ${totalTrials.toLocaleString()}`);
  console.log("\n" + "═".repeat(70));

  const outputStream = fs.createWriteStream(CONFIG.outputFile, { flags: "w" });
  const streamDone = new Promise<void>((resolve, reject) => {
    outputStream.on("finish", resolve);
    outputStream.on("error", reject);
  });

  let completed = 0;
  let skipped = 0;
  const skippedByReason: Record<string, number> = {};
  let batchCount = 0;
  const startTime = Date.now();

  const recordSkip = (reason: string): void => {
    skipped++;
    skippedByReason[reason] = (skippedByReason[reason] || 0) + 1;
  };

  for (const size of CONFIG.sizes) {
    for (const dataLen of CONFIG.dataLengths) {
      for (const ecc of CONFIG.eccLevels) {
        for (const jpegQuality of CONFIG.jpegQualities) {
          const skipCheck = shouldSkipCombo(dataLen, size, ecc, jpegQuality);

          for (const scale of CONFIG.scaleFactors) {
            for (const reEncodeCycles of CONFIG.reEncodeCycles) {
              if (skipCheck.skip) {
                recordSkip(skipCheck.reason ?? "pruned");
                completed++;
                batchCount++;
                continue;
              }

              let successCount = 0;
              let validTrials = 0;
              let moduleCount = skipCheck.moduleCount ?? 0;
              let modulePx = skipCheck.modulePx ?? 0;
              let aborted = false;

              const runTrial = async (trial: number): Promise<void> => {
                const testData = generateTestData(dataLen, completed * 1000 + trial);

                const qrResult = await generateQR(testData, size, ecc);
                if (!qrResult) {
                  return;
                }

                moduleCount = qrResult.moduleCount;
                modulePx = qrResult.modulePx;

                if (modulePx < CONFIG.minModulePx) {
                  recordSkip("modulePxActual");
                  aborted = true;
                  return;
                }

                validTrials++;

                const degraded = await applyDegradationChain(qrResult.canvas, {
                  jpegQuality,
                  scale,
                  reEncodeCycles,
                });

                if (tryDecode(degraded, testData)) {
                  successCount++;
                }
              };

              for (let trial = 0; trial < CONFIG.trialsPerCombo; trial++) {
                await runTrial(trial);
                if (aborted) break;
              }

              if (!aborted && validTrials > 0) {
                const baselineRate = successCount / validTrials;
                if (
                  baselineRate >= CONFIG.tier2Threshold &&
                  validTrials < CONFIG.trialsPerComboMax
                ) {
                  for (
                    let trial = CONFIG.trialsPerCombo;
                    trial < CONFIG.trialsPerComboMax;
                    trial++
                  ) {
                    await runTrial(trial);
                    if (aborted) break;
                  }
                }
              }

              if (aborted) {
                completed++;
                batchCount++;
                continue;
              }

              if (validTrials === 0) {
                recordSkip("qrFail");
              } else {
                const successRate = successCount / validTrials;
                const [ci95Lower, ci95Upper] = wilsonScoreInterval(
                  successCount,
                  validTrials,
                  CONFIG.confidenceLevel
                );

                const result: TestResult = {
                  size,
                  dataLen,
                  ecc,
                  jpegQuality,
                  scale,
                  reEncodeCycles,
                  moduleCount,
                  modulePx,
                  successCount,
                  trials: validTrials,
                  successRate,
                  ci95Lower,
                  ci95Upper,
                };

                outputStream.write(JSON.stringify(result) + "\n");
              }

              completed++;
              batchCount++;

              if (completed % 50 === 0) {
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = completed / elapsed;
                const eta = Math.ceil((totalCombos - completed) / rate);
                const pct = ((completed / totalCombos) * 100).toFixed(1);
                const memMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
                process.stdout.write(
                  `\r⏳ ${completed.toLocaleString()}/${totalCombos.toLocaleString()} (${pct}%) | ` +
                    `${rate.toFixed(0)}/s | ETA: ${eta}s | Mem: ${memMB}MB     `
                );
              }

              if (batchCount >= CONFIG.batchSize) {
                batchCount = 0;
                if (global.gc) {
                  global.gc();
                }
              }
            }
          }
        }
      }
    }
  }

  outputStream.end();
  await streamDone;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\r✅ Completed ${totalCombos.toLocaleString()} in ${elapsed}s (${skipped} skipped)          \n`
  );
  const skipEntries = Object.entries(skippedByReason);
  if (skipEntries.length > 0) {
    console.log("Skipped by reason:");
    for (const [reason, count] of skipEntries) {
      console.log(`   ${reason}: ${count.toLocaleString()}`);
    }
  }

  return totalCombos;
}

// ============================================================================
// ANALYSIS
// ============================================================================

async function analyzeResultsFromFile(filePath: string): Promise<void> {
  const results: TestResult[] = [];
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      results.push(JSON.parse(trimmed) as TestResult);
    } catch {
      continue;
    }
  }

  analyzeResults(results);
}

function analyzeResults(results: TestResult[]): void {
  console.log("\n" + "═".repeat(70));
  console.log("📊 COMPREHENSIVE ANALYSIS");
  console.log("═".repeat(70));

  // Overall Statistics
  const perfect = results.filter((r) => r.successRate === 1);
  const high = results.filter((r) => r.successRate >= 0.9 && r.successRate < 1);
  const medium = results.filter((r) => r.successRate >= 0.5 && r.successRate < 0.9);
  const zero = results.filter((r) => r.successRate === 0);

  console.log("\n📈 Overall Statistics:");
  console.log(
    `   100% success: ${perfect.length.toLocaleString()} (${((perfect.length / results.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `   90-99%: ${high.length.toLocaleString()} (${((high.length / results.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `   50-89%: ${medium.length.toLocaleString()} (${((medium.length / results.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `   0%: ${zero.length.toLocaleString()} (${((zero.length / results.length) * 100).toFixed(1)}%)`
  );

  // Scenario Analysis
  console.log("\n" + "─".repeat(70));
  console.log("🎯 MINIMUM WORKING PARAMETERS BY SCENARIO");
  console.log("─".repeat(70));
  console.log("(100% success rate with 95% CI lower bound ≥ 0.6)\n");

  const scenarios: Array<{ name: string; filter: (r: TestResult) => boolean }> = [
    {
      name: "PNG only",
      filter: (r) => r.jpegQuality === 100 && r.scale === 1.0 && r.reEncodeCycles === 0,
    },
    {
      name: "JPEG 90%",
      filter: (r) => r.jpegQuality === 90 && r.scale === 1.0 && r.reEncodeCycles === 0,
    },
    {
      name: "JPEG 85%",
      filter: (r) => r.jpegQuality === 85 && r.scale === 1.0 && r.reEncodeCycles === 0,
    },
    {
      name: "JPEG 80%",
      filter: (r) => r.jpegQuality === 80 && r.scale === 1.0 && r.reEncodeCycles === 0,
    },
    {
      name: "JPEG 75%",
      filter: (r) => r.jpegQuality === 75 && r.scale === 1.0 && r.reEncodeCycles === 0,
    },
    {
      name: "JPEG 70%",
      filter: (r) => r.jpegQuality === 70 && r.scale === 1.0 && r.reEncodeCycles === 0,
    },
    {
      name: "Scale 90%",
      filter: (r) => r.jpegQuality >= 90 && r.scale === 0.9 && r.reEncodeCycles === 0,
    },
    {
      name: "Scale 80%",
      filter: (r) => r.jpegQuality >= 90 && r.scale === 0.8 && r.reEncodeCycles === 0,
    },
    {
      name: "Scale 70%",
      filter: (r) => r.jpegQuality >= 90 && r.scale === 0.7 && r.reEncodeCycles === 0,
    },
    {
      name: "1 re-encode",
      filter: (r) => r.jpegQuality === 85 && r.scale === 1.0 && r.reEncodeCycles === 1,
    },
    {
      name: "2 re-encodes",
      filter: (r) => r.jpegQuality === 85 && r.scale === 1.0 && r.reEncodeCycles === 2,
    },
    {
      name: "Word/Pages (J85+S0.9+R1)",
      filter: (r) => r.jpegQuality === 85 && r.scale === 0.9 && r.reEncodeCycles === 1,
    },
    {
      name: "Heavy (J80+S0.8+R2)",
      filter: (r) => r.jpegQuality === 80 && r.scale === 0.8 && r.reEncodeCycles === 2,
    },
  ];

  console.log("Scenario                     │ Min Size │ Px/Mod │ Best ECC │ Max Data");
  console.log("─────────────────────────────┼──────────┼────────┼──────────┼──────────");

  for (const scenario of scenarios) {
    const passing = results.filter(
      (r) => r.successRate === 1 && r.ci95Lower >= 0.6 && scenario.filter(r)
    );

    if (passing.length > 0) {
      const minSize = Math.min(...passing.map((r) => r.size));
      const atMinSize = passing.filter((r) => r.size === minSize);
      const minModulePx = Math.min(...atMinSize.map((r) => r.modulePx));
      const maxDataLen = Math.max(...passing.map((r) => r.dataLen));

      const eccCounts: Record<string, number> = {};
      for (const r of atMinSize) {
        eccCounts[r.ecc] = (eccCounts[r.ecc] || 0) + 1;
      }
      const bestEcc = Object.entries(eccCounts).sort((a, b) => b[1] - a[1])[0][0];

      console.log(
        `${scenario.name.padEnd(28)} │ ${String(minSize).padStart(6)}px │ ${minModulePx.toFixed(2).padStart(6)} │ ${bestEcc.padStart(8)} │ ${String(maxDataLen).padStart(6)}ch`
      );
    } else {
      console.log(
        `${scenario.name.padEnd(28)} │ ${"FAIL".padStart(8)} │ ${"--".padStart(6)} │ ${"--".padStart(8)} │ ${"--".padStart(8)}`
      );
    }
  }

  // Module Size Analysis
  console.log("\n" + "─".repeat(70));
  console.log("📐 MODULE SIZE ANALYSIS (Word/Pages scenario)");
  console.log("─".repeat(70));

  const modulePxRanges = [
    [0.8, 1.0],
    [1.0, 1.2],
    [1.2, 1.4],
    [1.4, 1.6],
    [1.6, 1.8],
    [1.8, 2.0],
    [2.0, 2.5],
    [2.5, 3.0],
    [3.0, 4.0],
  ];

  console.log("\nPx/Module │ Avg Success │ Samples");
  console.log("──────────┼─────────────┼────────");

  for (const [minPx, maxPx] of modulePxRanges) {
    const inRange = results.filter(
      (r) =>
        r.modulePx >= minPx &&
        r.modulePx < maxPx &&
        r.jpegQuality === 85 &&
        r.scale === 0.9 &&
        r.reEncodeCycles === 1
    );

    if (inRange.length > 0) {
      const totalSuccess = inRange.reduce((sum, r) => sum + r.successCount, 0);
      const totalTrials = inRange.reduce((sum, r) => sum + r.trials, 0);
      const avgSuccess = totalSuccess / totalTrials;

      console.log(
        `${minPx.toFixed(1)}-${maxPx.toFixed(1)}    │ ${(avgSuccess * 100).toFixed(1).padStart(9)}% │ ${String(inRange.length).padStart(6)}`
      );
    }
  }

  // ECC Comparison
  console.log("\n" + "─".repeat(70));
  console.log("🔤 ECC LEVEL COMPARISON");
  console.log("─".repeat(70));

  for (const ecc of CONFIG.eccLevels) {
    const eccResults = results.filter((r) => r.ecc === ecc);
    const totalSuccess = eccResults.reduce((sum, r) => sum + r.successCount, 0);
    const totalTrials = eccResults.reduce((sum, r) => sum + r.trials, 0);
    const avgSuccess = totalSuccess / totalTrials;
    const perfectCount = eccResults.filter((r) => r.successRate === 1).length;

    const capacityNote =
      ecc === "L"
        ? "(7% recovery, max capacity)"
        : ecc === "M"
          ? "(15% recovery)"
          : ecc === "Q"
            ? "(25% recovery)"
            : "(30% recovery, min capacity)";

    console.log(`\nECC ${ecc} ${capacityNote}:`);
    console.log(`   Overall success: ${(avgSuccess * 100).toFixed(1)}%`);
    console.log(`   100% combos: ${perfectCount} / ${eccResults.length}`);
  }

  // FINAL RECOMMENDATIONS
  console.log("\n" + "═".repeat(70));
  console.log("🏆 FINAL RECOMMENDATIONS");
  console.log("═".repeat(70));

  // Target: Word/Pages scenario
  const targetResults = results.filter(
    (r) =>
      r.successRate === 1 &&
      r.ci95Lower >= 0.6 &&
      r.jpegQuality <= 85 &&
      r.scale >= 0.8 &&
      r.reEncodeCycles >= 1
  );

  if (targetResults.length > 0) {
    const minModulePx = Math.min(...targetResults.map((r) => r.modulePx));
    const safeModulePx = Math.ceil(minModulePx * 1.25 * 10) / 10; // +25% safety
    const minSize = Math.min(...targetResults.map((r) => r.size));

    const eccSuccess: Record<string, number> = {};
    for (const r of targetResults) {
      eccSuccess[r.ecc] = (eccSuccess[r.ecc] || 0) + 1;
    }
    const bestEcc = Object.entries(eccSuccess).sort((a, b) => b[1] - a[1])[0][0];

    console.log("\n📎 Target: Word/Pages (JPEG 85%, 80%+ scale, 1+ re-encode)");
    console.log("\nEmpirical findings:");
    console.log(`   Minimum working module size: ${minModulePx.toFixed(2)} px/module`);
    console.log(`   Minimum working QR size: ${minSize}px`);
    console.log(`   Most reliable ECC: ${bestEcc}`);

    console.log("\n✅ Recommended parameters (+25% safety margin):");
    console.log(`   MIN_MODULE_PX = ${safeModulePx.toFixed(1)}`);
    console.log(`   MIN_QR_SIDE = ${minSize}px`);
    console.log(`   MAX_QR_SIDE = ${Math.max(96, Math.round(minSize * 1.5))}px`);

    const typicalWidth = 800;
    const ratio = Math.ceil((minSize / typicalWidth) * 100) / 100;
    console.log(`   QR_SIZE_RATIO = ${ratio.toFixed(2)}`);
    console.log(`   ECC_LEVELS = ["${bestEcc}", ...] // ${bestEcc} preferred`);

    console.log("\n" + "─".repeat(70));
    console.log("📋 COPY-PASTE CODE:");
    console.log("─".repeat(70));
    console.log(`
// Empirically determined via exhaustive search
// Target: Word/Pages compatibility (JPEG 85%, 80%+ scale, 1+ re-encode cycle)
// Based on ${results.length.toLocaleString()} test combinations

const MIN_MODULE_PX = ${safeModulePx.toFixed(1)};  // Min ${minModulePx.toFixed(2)} + 25% safety
const MIN_QR_SIDE = ${minSize};      // Minimum working size
const MAX_QR_SIDE = ${Math.max(96, Math.round(minSize * 1.5))};     // Keep QRs reasonably small
const QR_SIZE_RATIO = ${ratio.toFixed(2)};  // ${minSize}px / ${typicalWidth}px typical
const ECC_LEVELS = ["${bestEcc}", "${bestEcc === "L" ? "M" : "L"}", "Q"] as const;
`);
  } else {
    console.log("\n⚠️  No reliable success under target conditions.");
    console.log("    Consider increasing QR sizes.");
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  console.log("\n");

  await runExhaustiveSearch();
  await analyzeResultsFromFile(CONFIG.outputFile);

  console.log(`\n💾 Results saved to ${CONFIG.outputFile}`);
}

main().catch(console.error);
