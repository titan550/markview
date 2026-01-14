import { test, expect } from "@playwright/test";

test.describe("markview basic functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page loads with split pane layout", async ({ page }) => {
    // Check that main elements exist
    await expect(page.locator("#markdownEditor")).toBeVisible();
    await expect(page.locator("#htmlPreview")).toBeVisible();
    await expect(page.locator("#resizeHandle")).toBeVisible();
  });

  test("typing markdown updates preview", async ({ page }) => {
    const editor = page.locator("#markdownEditor");
    const preview = page.locator("#htmlPreview");

    // Clear and type new content
    await editor.fill("# Hello World");

    // Wait for debounced render
    await page.waitForTimeout(200);

    // Check preview has heading
    await expect(preview.locator("h1")).toHaveText("Hello World");
  });

  test("toolbar buttons exist", async ({ page }) => {
    await expect(page.locator("#autofixBtn")).toBeVisible();
    await expect(page.locator("#copyHtmlBtn")).toBeVisible();
    await expect(page.locator("#copyMdBtn")).toBeVisible();
  });
});
