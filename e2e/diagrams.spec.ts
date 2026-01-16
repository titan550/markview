import { test, expect } from "@playwright/test";

test.describe("diagram rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders mermaid flowchart", async ({ page }) => {
    const editor = page.locator("#markdownEditor");
    const preview = page.locator("#htmlPreview");

    await editor.fill("```mermaid\nflowchart LR\n  A --> B\n```");
    await page.waitForTimeout(500);

    // Check that a diagram figure is rendered
    const figure = preview.locator("figure.diagram");
    await expect(figure).toBeVisible();

    // Check that it contains either an img or embedded svg (foreignObject diagrams use inline SVG)
    const hasImg = await figure.locator("img").count();
    const hasSvg = await figure.locator("svg").count();
    expect(hasImg + hasSvg).toBeGreaterThan(0);
  });

  test("renders graphviz/dot diagram", async ({ page }) => {
    const editor = page.locator("#markdownEditor");
    const preview = page.locator("#htmlPreview");

    await editor.fill("```dot\ndigraph G {\n  A -> B\n}\n```");
    await page.waitForTimeout(500);

    const figure = preview.locator("figure.diagram");
    await expect(figure).toBeVisible();
  });

  test("shows error for invalid mermaid syntax", async ({ page }) => {
    const editor = page.locator("#markdownEditor");
    const preview = page.locator("#htmlPreview");

    await editor.fill("```mermaid\ninvalid syntax here !!!\n```");
    await page.waitForTimeout(1000);

    // Error is shown as div.diagram-error inside figure
    const errorDiv = preview.locator("div.diagram-error");
    await expect(errorDiv).toBeVisible();
  });

  test("diagram preserves source in data attribute", async ({ page }) => {
    const editor = page.locator("#markdownEditor");
    const preview = page.locator("#htmlPreview");

    await editor.fill("```mermaid\nflowchart LR\n  A --> B\n```");
    await page.waitForTimeout(500);

    const figure = preview.locator("figure.diagram");
    const dataSource = await figure.getAttribute("data-source-base64");
    expect(dataSource).toBeTruthy();

    // Decode and verify content
    const decoded = Buffer.from(dataSource!, "base64").toString("utf-8");
    expect(decoded).toContain("flowchart");
  });
});
