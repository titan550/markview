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
});
