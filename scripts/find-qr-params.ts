#!/usr/bin/env npx tsx
/**
 * Find optimal QR parameters by searching the parameter space.
 *
 * Run: npx tsx scripts/find-qr-params.ts
 */

import { createCanvas } from "canvas";
// @ts-ignore - no types available
import jsQR from "jsqr";
// @ts-ignore - no types available
import QRCode from "qrcode";

interface TestResult {
  size: number;
  dataLen: number;
  ecc: string;
  jpegQuality: number;
  scale: number;
  moduleCount: number;
  modulePx: number;
  success: boolean;
}

// Generate test data similar to real chunks
function generateTestData(length: number): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "MV1/ABCD1234/1/1:";
  while (result.length < length) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result.substring(0, length);
}

// Render QR to canvas using qrcode library
async function renderQR(data: string, size: number, ecc: string): Promise<{ canvas: ReturnType<typeof createCanvas>; moduleCount: number; modulePx: number }> {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Generate QR matrix
  const qr = await QRCode.create(data, {
    errorCorrectionLevel: ecc as "L" | "M" | "Q" | "H",
    mode: "alphanumeric"
  });

  const moduleCount = qr.modules.size;
  const totalModules = moduleCount + 4; // quiet zone
  const cellSize = size / totalModules;
  const modulePx = cellSize;

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // Draw QR modules
  const offset = cellSize * 2;
  ctx.fillStyle = "#000000";

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.modules.get(row, col)) {
        ctx.fillRect(
          Math.floor(offset + col * cellSize),
          Math.floor(offset + row * cellSize),
          Math.ceil(cellSize),
          Math.ceil(cellSize)
        );
      }
    }
  }

  return { canvas, moduleCount, modulePx };
}

// Apply degradation (simulate JPEG compression via quality reduction)
function degradeImage(canvas: ReturnType<typeof createCanvas>, jpegQuality: number, scale: number): ReturnType<typeof createCanvas> {
  const width = Math.round(canvas.width * scale);
  const height = Math.round(canvas.height * scale);

  // Scale down
  const scaled = createCanvas(width, height);
  const ctx = scaled.getContext("2d");
  ctx.drawImage(canvas, 0, 0, width, height);

  // Simulate JPEG artifacts by adding noise proportional to quality loss
  if (jpegQuality < 100) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const noise = (100 - jpegQuality) / 100 * 30; // Max 30 noise at quality 0

    for (let i = 0; i < imageData.data.length; i += 4) {
      const n = (Math.random() - 0.5) * noise;
      imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + n));
      imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + n));
      imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + n));
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // Scale back up if needed (simulates resize artifacts)
  if (scale < 1) {
    const restored = createCanvas(canvas.width, canvas.height);
    const ctx2 = restored.getContext("2d");
    ctx2.drawImage(scaled, 0, 0, canvas.width, canvas.height);
    return restored;
  }

  return scaled;
}

// Try to decode QR
function tryDecode(canvas: ReturnType<typeof createCanvas>, expectedData: string): boolean {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const result = jsQR(imageData.data, canvas.width, canvas.height, {
    inversionAttempts: "attemptBoth"
  });

  return result !== null && result.data === expectedData;
}

// Main search function
async function searchParameters(): Promise<void> {
  console.log("🔍 QR Parameter Space Search\n");
  console.log("Testing QR decode reliability across parameter combinations...\n");

  const sizes = [48, 56, 64, 72, 80, 88, 96, 104, 112];
  const dataLengths = [35, 50, 70, 90, 110];
  const eccLevels = ["L", "M", "Q"];
  const jpegQualities = [100, 85, 70];
  const scaleFactors = [1.0, 0.8];

  const results: TestResult[] = [];
  const totalTests = sizes.length * dataLengths.length * eccLevels.length * jpegQualities.length * scaleFactors.length;
  let completed = 0;

  for (const size of sizes) {
    for (const dataLen of dataLengths) {
      for (const ecc of eccLevels) {
        for (const jpegQ of jpegQualities) {
          for (const scale of scaleFactors) {
            const testData = generateTestData(dataLen);

            try {
              const { canvas, moduleCount, modulePx } = await renderQR(testData, size, ecc);
              const degraded = degradeImage(canvas, jpegQ, scale);
              const success = tryDecode(degraded, testData);

              results.push({
                size,
                dataLen,
                ecc,
                jpegQuality: jpegQ,
                scale,
                moduleCount,
                modulePx,
                success
              });
            } catch {
              results.push({
                size,
                dataLen,
                ecc,
                jpegQuality: jpegQ,
                scale,
                moduleCount: 0,
                modulePx: 0,
                success: false
              });
            }

            completed++;
            if (completed % 50 === 0) {
              process.stdout.write(`\rProgress: ${completed}/${totalTests} tests...`);
            }
          }
        }
      }
    }
  }

  console.log(`\rCompleted ${totalTests} tests.                    \n`);

  // Analyze results
  analyzeResults(results);
}

function analyzeResults(results: TestResult[]): void {
  console.log("═".repeat(60));
  console.log("📊 RESULTS SUMMARY");
  console.log("═".repeat(60));

  // Find minimum working parameters for different conditions
  const conditions = [
    { name: "PNG, no scaling, short data (≤50)", filter: (r: TestResult) => r.jpegQuality === 100 && r.scale === 1 && r.dataLen <= 50 },
    { name: "PNG, no scaling, medium data (≤90)", filter: (r: TestResult) => r.jpegQuality === 100 && r.scale === 1 && r.dataLen <= 90 },
    { name: "JPEG 85%, no scaling", filter: (r: TestResult) => r.jpegQuality === 85 && r.scale === 1 },
    { name: "JPEG 70%, no scaling", filter: (r: TestResult) => r.jpegQuality === 70 && r.scale === 1 },
    { name: "PNG, 80% scale", filter: (r: TestResult) => r.jpegQuality === 100 && r.scale === 0.8 },
    { name: "JPEG 85%, 80% scale (worst case)", filter: (r: TestResult) => r.jpegQuality === 85 && r.scale === 0.8 },
  ];

  console.log("\n📏 Minimum Working Parameters by Condition:\n");
  console.log("Condition                              │ Min Size │ Min Px/Mod │ Best ECC");
  console.log("───────────────────────────────────────┼──────────┼────────────┼─────────");

  for (const cond of conditions) {
    const passing = results.filter(r => r.success && cond.filter(r));

    if (passing.length > 0) {
      const minSize = Math.min(...passing.map(r => r.size));
      const minModulePx = Math.min(...passing.map(r => r.modulePx));

      // Find which ECC works best at minimum size
      const atMinSize = passing.filter(r => r.size === minSize);
      const bestEcc = atMinSize[0]?.ecc || "?";

      console.log(`${cond.name.padEnd(38)} │ ${String(minSize).padStart(6)}px │ ${minModulePx.toFixed(2).padStart(10)} │ ${bestEcc}`);
    } else {
      console.log(`${cond.name.padEnd(38)} │ ${"FAIL".padStart(6)}   │ ${"N/A".padStart(10)} │ N/A`);
    }
  }

  // Find failure boundaries
  console.log("\n⚠️  Failure Boundaries (where decode starts failing):\n");

  const eccLevels = ["L", "M", "Q"];
  for (const ecc of eccLevels) {
    const eccResults = results.filter(r => r.ecc === ecc && r.jpegQuality === 85 && r.scale === 1);
    const grouped = new Map<number, TestResult[]>();

    for (const r of eccResults) {
      if (!grouped.has(r.dataLen)) grouped.set(r.dataLen, []);
      grouped.get(r.dataLen)!.push(r);
    }

    console.log(`ECC ${ecc}:`);
    for (const [dataLen, tests] of grouped) {
      const sorted = tests.sort((a, b) => a.size - b.size);
      const firstPass = sorted.find(t => t.success);
      const lastFail = sorted.filter(t => !t.success).pop();

      if (firstPass && lastFail) {
        console.log(`  ${dataLen} chars: fails at ${lastFail.size}px (${lastFail.modulePx.toFixed(2)} px/mod), works at ${firstPass.size}px (${firstPass.modulePx.toFixed(2)} px/mod)`);
      } else if (firstPass) {
        console.log(`  ${dataLen} chars: works at ${firstPass.size}px+`);
      } else {
        console.log(`  ${dataLen} chars: all failed`);
      }
    }
    console.log();
  }

  // Calculate recommended parameters
  console.log("═".repeat(60));
  console.log("🎯 RECOMMENDED PARAMETERS");
  console.log("═".repeat(60));

  // For JPEG 85% tolerance (realistic Word/Pages scenario)
  const realisticResults = results.filter(r => r.success && r.jpegQuality === 85 && r.scale >= 0.8);

  if (realisticResults.length > 0) {
    const minModulePx = Math.min(...realisticResults.map(r => r.modulePx));
    const safeModulePx = Math.ceil(minModulePx * 12) / 10; // Add 20% safety margin, round to 0.1

    console.log(`\nFor JPEG 85% + 80% scale tolerance (simulates Word/Pages):`);
    console.log(`  MIN_MODULE_PX = ${safeModulePx.toFixed(1)}  (minimum working: ${minModulePx.toFixed(2)}, +20% margin)`);

    // Calculate what QR size this means for typical data
    const typicalData = 70; // chars
    const typicalResults = realisticResults.filter(r => r.dataLen >= 60 && r.dataLen <= 80);
    if (typicalResults.length > 0) {
      const minSizeForTypical = Math.min(...typicalResults.map(r => r.size));
      console.log(`  MIN_QR_SIDE = ${minSizeForTypical}px  (for ~70 char chunks)`);
    }

    // Best ECC for capacity
    const eccCounts = { L: 0, M: 0, Q: 0 };
    for (const r of realisticResults) {
      eccCounts[r.ecc as keyof typeof eccCounts]++;
    }
    const bestEcc = Object.entries(eccCounts).sort((a, b) => b[1] - a[1])[0][0];
    console.log(`  ECC_LEVELS = ["${bestEcc}", ...]  (most successful at minimum sizes)`);
  }

  // Success rate summary
  console.log("\n📈 Success Rates by ECC Level:\n");
  for (const ecc of ["L", "M", "Q"]) {
    const eccResults = results.filter(r => r.ecc === ecc);
    const passRate = eccResults.filter(r => r.success).length / eccResults.length * 100;
    console.log(`  ECC ${ecc}: ${passRate.toFixed(1)}% pass rate`);
  }

  console.log("\n" + "═".repeat(60));
}

// Run
searchParameters().catch(console.error);
