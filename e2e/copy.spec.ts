import { test, expect } from "@playwright/test";

test.describe("copy functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("copy HTML button exists and is clickable", async ({ page }) => {
    const copyHtmlBtn = page.locator("#copyHtmlBtn");
    await expect(copyHtmlBtn).toBeVisible();
    await expect(copyHtmlBtn).toBeEnabled();
  });

  test("copy Markdown button exists and is clickable", async ({ page }) => {
    const copyMdBtn = page.locator("#copyMdBtn");
    await expect(copyMdBtn).toBeVisible();
    await expect(copyMdBtn).toBeEnabled();
  });

  test("copy HTML shows success feedback", async ({ page }) => {
    const editor = page.locator("#markdownEditor");
    await editor.fill("# Test");
    await page.waitForTimeout(200);

    const copyHtmlBtn = page.locator("#copyHtmlBtn");
    await copyHtmlBtn.click();

    // Button should show success state briefly
    await expect(copyHtmlBtn).toHaveClass(/success/);
  });

  test("copy Markdown shows success feedback", async ({ page }) => {
    const editor = page.locator("#markdownEditor");
    await editor.fill("# Test");
    await page.waitForTimeout(200);

    const copyMdBtn = page.locator("#copyMdBtn");
    await copyMdBtn.click();

    // Button should show success state briefly
    await expect(copyMdBtn).toHaveClass(/success/);
  });

  test("autofix button exists and is clickable", async ({ page }) => {
    const autofixBtn = page.locator("#autofixBtn");
    await expect(autofixBtn).toBeVisible();
    await expect(autofixBtn).toBeEnabled();
  });

  test("autofix normalizes NBSP in diagrams", async ({ page }) => {
    const editor = page.locator("#markdownEditor");

    // Type content with NBSP (using unicode escape)
    await editor.fill("```mermaid\nA\u00A0B\n```");
    await page.waitForTimeout(100);

    // Click autofix
    const autofixBtn = page.locator("#autofixBtn");
    await autofixBtn.click();
    await page.waitForTimeout(100);

    // Check that content was fixed
    const content = await editor.inputValue();
    expect(content).toContain("A B");
    expect(content).not.toContain("\u00A0");
  });

  test("QR embed and decode round-trip", async ({ page }) => {
    const editor = page.locator("#markdownEditor");

    // Create a simple mermaid diagram
    await editor.fill("```mermaid\nflowchart LR\n    A --> B\n```");

    // Wait for diagram to render
    await page.waitForSelector("figure.diagram svg", { timeout: 10000 });
    await page.waitForTimeout(500);

    // Test QR round-trip in browser context
    const result = await page.evaluate(async () => {
      // Get modules from window
      const encodePayload = (window as any).__test_encodePayload;
      const decodePayload = (window as any).__test_decodePayload;
      const planQrChunks = (window as any).__test_planQrChunks;
      const compositeQrFooter = (window as any).__test_compositeQrFooter;
      const decodeQrFromImage = (window as any).__test_decodeQrFromImage;

      if (!encodePayload || !planQrChunks) {
        return { error: "Test functions not exposed" };
      }

      // Create a small test payload to minimize chunks
      const testPayload = { lang: "mermaid", src: "A-->B" };
      const envelope = encodePayload(testPayload);

      // Create a larger canvas to give room for QR codes
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext("2d");
      if (!ctx) return { error: "No canvas context" };
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 800, 600);

      // Convert to PNG bytes
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png");
      });
      const arrayBuffer = await blob.arrayBuffer();
      let pngBytes = new Uint8Array(arrayBuffer);

      // Plan QR chunks
      const plan = planQrChunks(envelope, 800);
      if (!plan) {
        return { error: "QR plan failed" };
      }

      // Composite QR footer
      pngBytes = await compositeQrFooter(pngBytes, plan);

      // Now decode QR from the composited image
      const decodedEnvelope = await decodeQrFromImage(pngBytes);
      if (!decodedEnvelope) {
        return {
          error: "QR decode failed",
          chunks: plan.chunks.length,
          pngSize: pngBytes.length,
          qrSidePx: plan.qrSidePx,
          ecc: plan.ecc,
        };
      }

      // Decode payload
      const decodedPayload = decodePayload(decodedEnvelope);
      if (!decodedPayload) {
        return { error: "Payload decode failed" };
      }

      return {
        success: true,
        originalLang: testPayload.lang,
        decodedLang: decodedPayload.lang,
        originalSrc: testPayload.src,
        decodedSrc: decodedPayload.src,
      };
    });

    // Check if test functions were exposed
    if ((result as any).error === "Test functions not exposed") {
      // Skip test if functions not exposed - this is expected in production builds
      test.skip();
      return;
    }

    if ((result as any).error) {
      console.log("QR test failed:", result);
    }
    expect((result as any).error).toBeUndefined();
    expect((result as any).success).toBe(true);
    expect((result as any).decodedLang).toBe((result as any).originalLang);
    expect((result as any).decodedSrc).toBe((result as any).originalSrc);
  });
});
